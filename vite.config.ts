import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Dev-only Vite middleware for /sitemap.xml and /robots.txt.
 * Production: Nitro middleware in server/middleware/seo.ts handles these.
 */
function seoPlugin(): Plugin {
  return {
    name: "app-builder:seo",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?", 1)[0] ?? "";

        if (path === "/sitemap.xml") {
          try {
            const { getSql } = (await server.ssrLoadModule("/src/lib/db.ts")) as {
              getSql: () => Promise<{ query: <T>(sql: string, params?: unknown[]) => Promise<T[]> }>;
            };
            const today = new Date().toISOString().slice(0, 10);
            const BASE = "https://geldesat.com";
            const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const entry = (loc: string, lm: string, cf: string, p: string) =>
              `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lm}</lastmod>\n    <changefreq>${cf}</changefreq>\n    <priority>${p}</priority>\n  </url>`;

            const staticUrls = [
              entry(`${BASE}/`, today, "daily", "1.0"),
              entry(`${BASE}/ilan-ver`, today, "weekly", "0.7"),
              // Kurumsal / yasal sayfalar
              entry(`${BASE}/sayfa/hakkimizda`, today, "monthly", "0.4"),
              entry(`${BASE}/sayfa/iletisim`, today, "monthly", "0.4"),
              entry(`${BASE}/sayfa/kvkk`, today, "monthly", "0.3"),
              entry(`${BASE}/sayfa/gizlilik`, today, "monthly", "0.3"),
              entry(`${BASE}/sayfa/cerez`, today, "monthly", "0.3"),
              entry(`${BASE}/sayfa/kullanim`, today, "monthly", "0.3"),
              entry(`${BASE}/sayfa/uyelik`, today, "monthly", "0.3"),
            ];
            let extra: string[] = [];
            try {
              const sql = await getSql();
              const cats = await sql.query<{ slug: string; updated_at: string | null }>(
                "SELECT slug, updated_at FROM categories ORDER BY sort_order, name",
              );
              const listings = await sql.query<{ slug: string; updated_at: string }>(
                `SELECT slug, updated_at FROM listings WHERE status='ACTIVE' AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC LIMIT 50000`,
              );
              let storeEntries: string[] = [];
              let sellerEntries: string[] = [];
              try {
                const stores = await sql.query<{ slug: string; updated_at: string | null }>(
                  "SELECT slug, updated_at FROM stores ORDER BY created_at DESC LIMIT 10000",
                );
                storeEntries = stores.map((s) => entry(`${BASE}/magaza/${s.slug}`, s.updated_at ? String(s.updated_at).slice(0,10) : today, "weekly", "0.5"));
              } catch { /* stores tablosu yoksa atla */ }
              try {
                const sellers = await sql.query<{ user_id: string; updated_at: string | null }>(
                  "SELECT user_id, updated_at FROM profiles ORDER BY created_at DESC LIMIT 10000",
                );
                sellerEntries = sellers.map((p) => entry(`${BASE}/satici/${p.user_id}`, p.updated_at ? String(p.updated_at).slice(0,10) : today, "weekly", "0.4"));
              } catch { /* profiles tablosu yoksa atla */ }
              extra = [
                ...cats.map((c) => entry(`${BASE}/category/${c.slug}`, c.updated_at ? String(c.updated_at).slice(0,10) : today, "weekly", "0.7")),
                ...listings.map((l) => entry(`${BASE}/ilan/${l.slug}`, String(l.updated_at).slice(0,10) || today, "daily", "0.6")),
                ...storeEntries,
                ...sellerEntries,
              ];
            } catch { /* DB hatası */ }

            const xml =
              `<?xml version="1.0" encoding="UTF-8"?>\n` +
              `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
              [...staticUrls, ...extra].join("\n") +
              `\n</urlset>`;
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/xml; charset=utf-8");
            res.end(xml);
          } catch (err) {
            console.error("[app-builder] /sitemap.xml failed:", err);
            res.statusCode = 500;
            res.end("sitemap error");
          }
          return;
        }

        if (path === "/robots.txt") {
          const BASE = "https://geldesat.com";
          const txt = [
            "User-agent: *",
            "Allow: /",
            "",
            "Disallow: /admin",
            "Disallow: /profil",
            "Disallow: /ilanlarim",
            "Disallow: /mesajlar",
            "Disallow: /favoriler",
            "Disallow: /bildirimler",
            "Disallow: /doping",
            "Disallow: /arsiv",
            "Disallow: /login",
            "",
            "# API rotaları",
            "Disallow: /api/",
            "",
            "# Arama/filtreleme sayfaları — duplicate content önlemi",
            "Disallow: /search",
            "",
            `Sitemap: ${BASE}/sitemap.xml`,
          ].join("\n");
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(txt);
          return;
        }

        next();
      });
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    // SEO: /sitemap.xml ve /robots.txt (dev modda Vite middleware)
    seoPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset:
              process.env.NITRO_PRESET === "node-server" ||
              process.env.COOLIFY ||
              process.env.NIXPACKS_METADATA
                ? "node-server"
                : "vercel",
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
          }),
        ]
      : []),
    viteReact(),
  ],
}));
