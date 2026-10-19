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

export type StoredImage = { mimeType: string; data: Uint8Array };

/**
 * Response for a stored listing photo. `?w=240|480|800|1200` returns a resized
 * WebP copy for cards, thumbnails and the gallery; anything else serves the
 * master. Photos are never rewritten under the same key, so the key is a strong
 * ETag — and revalidations and cached thumbnails are answered without `load`
 * pulling the photo out of the database. Returns null when `load` finds nothing.
 */
export async function storedImageResponse(
  request: Request,
  key: string,
  load: () => Promise<StoredImage | null>,
): Promise<Response | null> {
  const w = Number(new URL(request.url).searchParams.get("w"));
  const width = (VARIANT_WIDTHS as readonly number[]).includes(w) ? w : 0;
  const etag = `"${key}${width ? `-${width}` : ""}"`;
  const headers: Record<string, string> = {
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const hit = width ? cachedVariant(key, width) : undefined;
  if (hit) return imageResponse(hit, "image/webp", headers);

  const image = await load();
  if (!image) return null;
  if (width) {
    try {
      return imageResponse(await variant(key, image.data, width), "image/webp", headers);
    } catch (err) {
      console.warn("[images] variant failed, serving master", err);
    }
  }
  return imageResponse(image.data, image.mimeType, headers);
}

function imageResponse(body: Uint8Array, contentType: string, headers: Record<string, string>): Response {
  const bytes = new Uint8Array(body.byteLength);
  bytes.set(body);
  return new Response(bytes, {
    headers: { ...headers, "Content-Type": contentType, "Content-Length": String(bytes.byteLength) },
  });
}

function cachedVariant(key: string, width: number): Buffer | undefined {
  const cacheKey = `${key}@${width}`;
  const hit = variantCache.get(cacheKey);
  if (hit) {
    variantCache.delete(cacheKey); // refresh LRU position
    variantCache.set(cacheKey, hit);
  }
  return hit;
}

async function variant(key: string, data: Uint8Array, width: number): Promise<Buffer> {
  const hit = cachedVariant(key, width);
  if (hit) return hit;
  const { resizeVariant } = await import("./image-pipeline.server");
  const out = await resizeVariant(data, width);
  remember(`${key}@${width}`, out);
  return out;
}
