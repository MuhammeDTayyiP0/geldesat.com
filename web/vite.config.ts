import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
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
    name: "geldesat:pglite-bootstrap",
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
        console.error("[db] dev bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Dev-only bridge to the production SEO & App-Links middlewares, so sitemaps,
 * robots.txt and .well-known files have a single implementation.
 */
function seoDevPlugin(): Plugin {
  const paths = /^\/(?:robots\.txt|sitemap[\w-]*\.xml)$/;
  return {
    name: "geldesat:seo-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const isWellKnown = url.pathname === "/.well-known/assetlinks.json" || url.pathname === "/.well-known/apple-app-site-association";
        if (!paths.test(url.pathname) && !isWellKnown) return next();
        try {
          const modPath = isWellKnown ? "/server/middleware/app-links.ts" : "/server/middleware/seo.ts";
          const mod = (await server.ssrLoadModule(modPath)) as {
            default: (event: { url: URL; req?: { method?: string } }, next: () => unknown) => Promise<unknown> | unknown;
          };
          const result = await mod.default({ url, req: { method: req.method } }, () => null);
          if (!(result instanceof Response)) return next();
          res.statusCode = result.status;
          result.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await result.arrayBuffer()));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

const APP_BUILD_ID = (
  process.env.SOURCE_COMMIT ||
  process.env.GIT_COMMIT ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  Date.now().toString(36)
).slice(0, 16);

export default defineConfig(({ command, isPreview }) => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify(APP_BUILD_ID),
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  resolve: { tsconfigPaths: true },
  // PGLite is the local-dev database. Bundling it copies its 16 MB of WASM into
  // the public assets: the browser build sees it through server modules (their
  // code is tree-shaken away, the WASM files were not), and the server build
  // would inline it. External, it loads from node_modules on the rare run that
  // needs it.
  ssr: { external: ["@electric-sql/pglite"] },
  environments: {
    client: { build: { rollupOptions: { external: ["@electric-sql/pglite"] } } },
  },
  plugins: [
    pgliteBootstrapPlugin(),
    seoDevPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          // Self-hosted Node server (Coolify / Docker); server/ holds Nitro middleware.
          nitro({ preset: "node-server", serverDir: "./server" }),
        ]
      : []),
    viteReact(),
  ],
}));
