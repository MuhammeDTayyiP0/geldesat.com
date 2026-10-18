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
 * Dev-only bridge to the production SEO middleware (server/middleware/seo.ts),
 * so sitemaps and robots.txt have a single implementation. Production runs the
 * same file through Nitro.
 */
function seoDevPlugin(): Plugin {
  const paths = /^\/(?:robots\.txt|sitemap[\w-]*\.xml)$/;
  return {
    name: "geldesat:seo-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!paths.test(url.pathname)) return next();
        try {
          const mod = (await server.ssrLoadModule("/server/middleware/seo.ts")) as {
            default: (event: { url: URL }, next: () => unknown) => Promise<unknown>;
          };
          const result = await mod.default({ url }, () => null);
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

export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  resolve: { tsconfigPaths: true },
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
