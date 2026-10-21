import { createFileRoute } from "@tanstack/react-router";
import { gzipSync } from "node:zlib";
import { getSql } from "@/lib/db";
import { HASH_PATTERN } from "@/lib/server/ota";

/**
 * Update files by content hash. They never change under a hash, so they are
 * cached forever (here, in the app and in any proxy). JS bundles go out gzipped.
 */

type Cached = { type: string; raw: Buffer; gz: Buffer | null };
const cache = new Map<string, Cached>();
const CACHE_LIMIT_BYTES = 96 * 1024 * 1024;
let cacheBytes = 0;

function remember(hash: string, entry: Cached) {
  cache.set(hash, entry);
  cacheBytes += entry.raw.byteLength + (entry.gz?.byteLength ?? 0);
  for (const [k, v] of cache) {
    if (cacheBytes <= CACHE_LIMIT_BYTES) break;
    cache.delete(k);
    cacheBytes -= v.raw.byteLength + (v.gz?.byteLength ?? 0);
  }
}

const COMPRESSIBLE = /javascript|json|text|svg|xml/i;

export const Route = createFileRoute("/api/ota/assets/$hash")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!HASH_PATTERN.test(params.hash)) return new Response(null, { status: 404 });
        let entry = cache.get(params.hash);
        if (!entry) {
          try {
            const sql = await getSql();
            const rows = await sql.query<{ content_type: string; data: Uint8Array }>("select content_type, data from ota_assets where hash = $1", [params.hash]);
            if (!rows[0]) return new Response(null, { status: 404 });
            const raw = Buffer.from(rows[0].data);
            const type = rows[0].content_type;
            entry = { type, raw, gz: COMPRESSIBLE.test(type) && raw.byteLength > 1024 ? gzipSync(raw, { level: 9 }) : null };
            remember(params.hash, entry);
          } catch (err) {
            console.error("[ota] asset failed:", err);
            return new Response(null, { status: 500 });
          }
        }
        const gzip = entry.gz && /\bgzip\b/i.test(request.headers.get("accept-encoding") ?? "");
        const body = gzip ? entry.gz! : entry.raw;
        return new Response(new Uint8Array(body), {
          status: 200,
          headers: {
            "content-type": entry.type,
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
            vary: "accept-encoding",
            ...(gzip ? { "content-encoding": "gzip" } : {}),
          },
        });
      },
    },
  },
});
