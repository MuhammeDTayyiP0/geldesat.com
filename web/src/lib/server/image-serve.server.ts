import { VARIANT_WIDTHS } from "./image-pipeline.server";

/** Recently built thumbnails; masters are immutable so entries never go stale. */
const variantCache = new Map<string, Buffer>();
const CACHE_LIMIT_BYTES = 64 * 1024 * 1024;
let cacheBytes = 0;

function remember(key: string, data: Buffer) {
  variantCache.set(key, data);
  cacheBytes += data.byteLength;
  for (const [k, v] of variantCache) {
    if (cacheBytes <= CACHE_LIMIT_BYTES) break;
    variantCache.delete(k);
    cacheBytes -= v.byteLength;
  }
}

async function variant(key: string, data: Uint8Array, width: number): Promise<Buffer> {
  const cacheKey = `${key}@${width}`;
  const hit = variantCache.get(cacheKey);
  if (hit) {
    variantCache.delete(cacheKey); // refresh LRU position
    variantCache.set(cacheKey, hit);
    return hit;
  }
  const { resizeVariant } = await import("./image-pipeline.server");
  const out = await resizeVariant(data, width);
  remember(cacheKey, out);
  return out;
}

/**
 * Response for a stored listing photo. `?w=240|480|800` returns a resized WebP
 * copy for cards and thumbnails; anything else serves the master. Photos are
 * never rewritten under the same key, so the key is a strong ETag.
 */
export async function storedImageResponse(request: Request, key: string, mimeType: string, data: Uint8Array): Promise<Response> {
  const w = Number(new URL(request.url).searchParams.get("w"));
  const width = (VARIANT_WIDTHS as readonly number[]).includes(w) ? w : 0;
  const etag = `"${key}${width ? `-${width}` : ""}"`;
  const headers: Record<string, string> = {
    "Content-Type": width ? "image/webp" : mimeType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  let body: Uint8Array = data;
  if (width) {
    try {
      body = await variant(key, data, width);
    } catch (err) {
      console.warn("[images] variant failed, serving master", err);
      headers["Content-Type"] = mimeType;
    }
  }
  const bytes = new Uint8Array(body.byteLength);
  bytes.set(body);
  return new Response(bytes, { headers: { ...headers, "Content-Length": String(bytes.byteLength) } });
}
