import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
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
 * Dev-only Vite middleware for sitemap index + sub-sitemaps + robots.txt.
 * Production: Nitro middleware in server/middleware/seo.ts handles these.
 */
function seoPlugin(): Plugin {
  return {
    name: "app-builder:seo",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const [path, qs = ""] = rawUrl.split("?");
        const params = new URLSearchParams(qs);
        const BASE = "https://www.geldesat.com";
        const today = new Date().toISOString().slice(0, 10);

        const esc = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
        const entry = (loc: string, lm: string, cf: string, p: string, image?: { loc: string; title?: string } | null) => {
          let xml = `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lm}</lastmod>\n    <changefreq>${cf}</changefreq>\n    <priority>${p}</priority>`;
          if (image && image.loc) {
            xml += `\n    <image:image>\n      <image:loc>${esc(image.loc)}</image:loc>`;
            if (image.title) xml += `\n      <image:title>${esc(image.title)}</image:title>`;
            xml += `\n    </image:image>`;
          }
          xml += `\n  </url>`;
          return xml;
        };
        const wrapUrlset = (entries: string[]) =>
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join("\n")}\n</urlset>`;

        const sendXml = (body: string) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.end(body);
        };

        // Helper to get SQL connection
        async function getSql() {
          const { getSql: _getSql } = (await server.ssrLoadModule("/src/lib/db.ts")) as {
            getSql: () => Promise<{ query: <T>(sql: string, params?: unknown[]) => Promise<T[]> }>;
          };
          return _getSql();
        }

        // ── /sitemap.xml — index ──
        if (path === "/sitemap.xml") {
          try {
            let listingPages = 1;
            try {
              const sql = await getSql();
              const res2 = await sql.query<{ cnt: string }>(
                `SELECT COUNT(*) AS cnt FROM listings WHERE status='ACTIVE' AND (expires_at IS NULL OR expires_at>now())`,
              );
              const total = parseInt(res2[0]?.cnt ?? "0", 10);
              listingPages = Math.max(1, Math.ceil(total / 10000));
            } catch { /* DB bağlantısı yoksa 1 sayfa */ }

            const sitemaps = [
              { loc: `${BASE}/sitemap-static.xml`, lastmod: today },
              { loc: `${BASE}/sitemap-categories.xml`, lastmod: today },
              ...Array.from({ length: listingPages }, (_, i) => ({
                loc: `${BASE}/sitemap-listings-${i + 1}.xml`,
                lastmod: today,
              })),
              { loc: `${BASE}/sitemap-stores.xml`, lastmod: today },
              { loc: `${BASE}/sitemap-sellers.xml`, lastmod: today },
            ];
            const xml =
              `<?xml version="1.0" encoding="UTF-8"?>\n` +
              `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
              sitemaps
                .map(
                  (s) =>
                    `  <sitemap>\n    <loc>${esc(s.loc)}</loc>\n    <lastmod>${s.lastmod}</lastmod>\n  </sitemap>`,
                )
                .join("\n") +
              `\n</sitemapindex>`;
            sendXml(xml);
          } catch (err) {
            console.error("[app-builder] /sitemap.xml failed:", err);
            res.statusCode = 500;
            res.end("sitemap error");
          }
          return;
        }

        // ── /sitemap-static.xml ──
        if (path === "/sitemap-static.xml") {
          sendXml(wrapUrlset([
            entry(`${BASE}/`, today, "daily", "1.0"),
            entry(`${BASE}/harita`, today, "daily", "0.8"),
            entry(`${BASE}/sayfa/hakkimizda`, today, "monthly", "0.5"),
            entry(`${BASE}/sayfa/iletisim`, today, "monthly", "0.5"),
            entry(`${BASE}/sayfa/kvkk`, today, "monthly", "0.3"),
            entry(`${BASE}/sayfa/gizlilik`, today, "monthly", "0.3"),
            entry(`${BASE}/sayfa/cerez`, today, "monthly", "0.3"),
            entry(`${BASE}/sayfa/kullanim`, today, "monthly", "0.3"),
            entry(`${BASE}/sayfa/uyelik`, today, "monthly", "0.3"),
          ]));
          return;
        }

        // ── /sitemap-categories.xml ──
        if (path === "/sitemap-categories.xml") {
          try {
            const sql = await getSql();
            const cats = await sql.query<{ slug: string; lastmod: string }>(
              `WITH cat_dates AS (
                 SELECT category_id, MAX(COALESCE(updated_at, created_at)) as max_date
                 FROM listings
                 WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now())
                 GROUP BY category_id
               )
               SELECT c.slug,
                      COALESCE(TO_CHAR(cd.max_date, 'YYYY-MM-DD'), $1) as lastmod
               FROM categories c
               LEFT JOIN cat_dates cd ON cd.category_id = c.id
               ORDER BY c.sort_order, c.name`,
              [today],
            );
            sendXml(wrapUrlset(
              cats.map((c) =>
                entry(`${BASE}/category/${c.slug}`, c.lastmod || today, "daily", "0.8"),
              ),
            ));
          } catch { sendXml(wrapUrlset([])); }
          return;
        }

        // ── /sitemap-listings-N.xml veya ?page=N ──
        const listingsMatch = path.match(/^\/sitemap-listings(?:-(\d+))?\.xml$/);
        if (listingsMatch) {
          const pageFromPath = listingsMatch[1] ? parseInt(listingsMatch[1], 10) : NaN;
          const pageFromQuery = parseInt(params.get("page") ?? "1", 10);
          const pageNum = !isNaN(pageFromPath) ? pageFromPath : pageFromQuery;
          const page = Math.max(1, isNaN(pageNum) ? 1 : pageNum);
          const offset = (page - 1) * 10000;
          try {
            const sql = await getSql();
            const listings = await sql.query<{
              slug: string;
              title: string;
              images: string[] | string | null;
              updated_at: string;
            }>(
              `SELECT slug, title, images, updated_at FROM listings WHERE status='ACTIVE' AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
              [10000, offset],
            );
            sendXml(wrapUrlset(
              listings.map((l) => {
                let firstImg: string | null = null;
                if (l.images) {
                  const imgs = Array.isArray(l.images)
                    ? l.images
                    : typeof l.images === "string"
                      ? (() => {
                          try {
                            return JSON.parse(l.images);
                          } catch {
                            return [];
                          }
                        })()
                      : [];
                  if (imgs.length > 0 && typeof imgs[0] === "string") {
                    firstImg = imgs[0].startsWith("http")
                      ? imgs[0]
                      : `${BASE}${imgs[0].startsWith("/") ? "" : "/"}${imgs[0]}`;
                  }
                }
                return entry(
                  `${BASE}/ilan/${l.slug}`,
                  String(l.updated_at).slice(0, 10) || today,
                  "daily",
                  "0.6",
                  firstImg ? { loc: firstImg, title: l.title } : null,
                );
              }),
            ));
          } catch { sendXml(wrapUrlset([])); }
          return;
        }

        // ── /sitemap-stores.xml ──
        if (path === "/sitemap-stores.xml") {
          try {
            const sql = await getSql();
            const stores = await sql.query<{ slug: string; lastmod: string }>(
              `SELECT s.slug,
                      COALESCE(TO_CHAR(MAX(l.updated_at), 'YYYY-MM-DD'), TO_CHAR(s.created_at, 'YYYY-MM-DD'), $1) as lastmod
               FROM stores s
               LEFT JOIN listings l ON l.store_id = s.id AND l.status = 'ACTIVE' AND (l.expires_at IS NULL OR l.expires_at > now())
               GROUP BY s.slug, s.created_at
               ORDER BY s.created_at DESC
               LIMIT 10000`,
              [today],
            );
            sendXml(wrapUrlset(
              stores.map((s) =>
                entry(`${BASE}/magaza/${s.slug}`, s.lastmod || today, "weekly", "0.6"),
              ),
            ));
          } catch { sendXml(wrapUrlset([])); }
          return;
        }

        // ── /sitemap-sellers.xml ──
        if (path === "/sitemap-sellers.xml") {
          try {
            const sql = await getSql();
            const sellers = await sql.query<{ user_id: string; lastmod: string }>(
              `SELECT p.user_id,
                      COALESCE(TO_CHAR(MAX(l.updated_at), 'YYYY-MM-DD'), TO_CHAR(p.created_at, 'YYYY-MM-DD'), $1) as lastmod
               FROM profiles p
               JOIN listings l ON l.user_id = p.user_id AND l.status = 'ACTIVE' AND (l.expires_at IS NULL OR l.expires_at > now())
               GROUP BY p.user_id, p.created_at
               ORDER BY p.created_at DESC
               LIMIT 10000`,
              [today],
            );
            sendXml(wrapUrlset(
              sellers.map((p) =>
                entry(`${BASE}/satici/${p.user_id}`, p.lastmod || today, "weekly", "0.5"),
              ),
            ));
          } catch { sendXml(wrapUrlset([])); }
          return;
        }

        // ── /robots.txt ──
        if (path === "/robots.txt") {
          const txt = [
            "User-agent: *",
            "Allow: /",
            "",
            "# Uygulama sayfaları kendi noindex meta direktiflerini Google'a iletebilmelidir.",
            "",
            "# API rotaları",
            "Disallow: /api/",
            "",
            "# Arama sayfaları noindex meta taşır; taramaya açık kalmalı ki Google bu direktifi okuyabilsin.",
            "",
            "# Sitemap index",
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
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
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
            // Auto-registers the SEO and application server middleware.
            serverDir: "./server",
          }),
        ]
      : []),
    viteReact(),
  ],
}));
