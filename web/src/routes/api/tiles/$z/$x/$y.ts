import { createFileRoute } from "@tanstack/react-router";
import { rateLimit, viewerKey } from "@/lib/server/helpers";

/**
 * Map tiles for the chat's meeting points (web and app), served from
 * OpenStreetMap through this server so no API key is needed and OSM's tile
 * policy is met: an identifying User-Agent, light traffic and long caching
 * (here in memory, and in browsers/CDN through Cache-Control).
 *
 *   GET /api/tiles/{z}/{x}/{y}.png
 */
const UPSTREAM = "https://tile.openstreetmap.org";
const USER_AGENT = "GeldeSat/1.0 (https://www.geldesat.com; destek@geldesat.com)";
const MAX_CACHED = 3000;
const TTL_MS = 7 * 24 * 60 * 60_000;

type Cached = { at: number; body: Uint8Array<ArrayBuffer> };
const globalRef = globalThis as typeof globalThis & { __geldesatTileCache__?: Map<string, Cached> };
const cache = (globalRef.__geldesatTileCache__ ??= new Map());

/** Fetches in flight, so many visitors asking for one tile cause one upstream request. */
const inFlight = new Map<string, Promise<Uint8Array<ArrayBuffer> | number>>();

async function fetchTile(key: string): Promise<Uint8Array<ArrayBuffer> | number> {
  const res = await fetch(`${UPSTREAM}/${key}.png`, {
    headers: { "User-Agent": USER_AGENT, Referer: "https://www.geldesat.com/" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return res.status === 404 ? 404 : 502;
  const body = new Uint8Array(await res.arrayBuffer());
  cache.set(key, { at: Date.now(), body });
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
  return body;
}

function tileResponse(body: Uint8Array<ArrayBuffer>) {
  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const Route = createFileRoute("/api/tiles/$z/$x/$y")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const z = Number(params.z);
        const x = Number(params.x);
        const y = Number(params.y.replace(/\.png$/, ""));
        const max = 2 ** z;
        if (![z, x, y].every(Number.isInteger) || z < 0 || z > 19 || x < 0 || y < 0 || x >= max || y >= max) {
          return new Response(null, { status: 400 });
        }
        const key = `${z}/${x}/${y}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < TTL_MS) {
          // Keep recently used tiles at the end of the map (simple LRU).
          cache.delete(key);
          cache.set(key, hit);
          return tileResponse(hit.body);
        }
        // Bulk downloading through us would get this server's IP blocked by OSM,
        // and the maps would break for everyone. Cached tiles above stay free.
        try {
          rateLimit(`tiles:${viewerKey(request.headers)}`, 300, 60_000);
        } catch {
          return new Response(null, { status: 429 });
        }
        try {
          let pending = inFlight.get(key);
          if (!pending) {
            pending = fetchTile(key).finally(() => inFlight.delete(key));
            inFlight.set(key, pending);
          }
          const result = await pending;
          return typeof result === "number" ? new Response(null, { status: result }) : tileResponse(result);
        } catch {
          return new Response(null, { status: 502 });
        }
      },
    },
  },
});
