import { randomUUID } from "node:crypto";
import { getSql, type Sql } from "@/lib/db";
import { rateLimit } from "./helpers";

/** Photos uploaded but not yet attached to any listing, per user, per day. */
const PENDING_IMAGE_CAP = 60;
const ORPHAN_SQL = `not exists (
  select 1 from listings l
  where l.images @> jsonb_build_array('/api/mobile/images/' || i.id)
     or l.images @> jsonb_build_array('/uploads/' || i.storage_key))`;

let lastOrphanSweep = 0;

/** Delete photos that were uploaded more than a day ago and never attached to a listing. */
async function sweepOrphanImages(sql: Sql): Promise<void> {
  if (Date.now() - lastOrphanSweep < 60 * 60_000) return;
  lastOrphanSweep = Date.now();
  await sql.query(`delete from mobile_listing_images i where i.created_at < now() - interval '24 hours' and ${ORPHAN_SQL}`);
}

/** Throttle uploads and cap unattached photos so the database cannot be filled with junk. */
export async function assertUploadAllowed(sql: Sql, userId: string): Promise<void> {
  rateLimit(`upload:${userId}`, 40, 10 * 60_000);
  const pending = await sql.query<{ n: number }>(
    `select count(*)::int as n from mobile_listing_images i
     where i.user_id=$1 and i.created_at > now() - interval '24 hours' and ${ORPHAN_SQL}`,
    [userId],
  );
  if ((pending[0]?.n ?? 0) >= PENDING_IMAGE_CAP) {
    throw new Error("Çok fazla bekleyen fotoğraf yüklediniz. Önce ilanınızı kaydedin.");
  }
  void sweepOrphanImages(sql).catch((err) => console.warn("[upload] orphan sweep failed", err));
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export type ImageMime = "image/jpeg" | "image/png" | "image/webp";
const EXT: Record<ImageMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Real image type from the file's leading bytes; the client-declared type is not trusted. */
export function sniffImageMime(bytes: Uint8Array): ImageMime | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, j) => bytes[i + j] === b);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp"; // RIFF....WEBP
  return null;
}

/** Validate size and content of an uploaded photo, returning its sniffed type. */
export function assertImageBytes(bytes: Uint8Array): ImageMime {
  if (bytes.byteLength < 1) throw new Error("Fotoğraf boş.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Fotoğraf en fazla 2 MB olabilir.");
  const mime = sniffImageMime(bytes);
  if (!mime) throw new Error("Geçersiz görsel. JPEG, PNG veya WebP fotoğraf yükleyin.");
  return mime;
}

/**
 * Store a web upload in Postgres so image URLs survive redeploys.
 * The public URL path stays `/uploads/<filename>` for existing web clients.
 */
export async function saveListingImage(bytes: Uint8Array, userId: string): Promise<string> {
  const mimeType = assertImageBytes(bytes);
  const filename = `${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 10)}.${EXT[mimeType]}`;
  const sql = await getSql();
  await assertUploadAllowed(sql, userId);
  await sql.query(
    "insert into mobile_listing_images (id,user_id,storage_key,mime_type,data) values ($1,$2,$3,$4,$5)",
    [randomUUID(), userId, filename, mimeType, Buffer.from(bytes)],
  );
  return `/uploads/${filename}`;
}

/** Remove stored image objects detached from a listing, preserving shared references. */
export async function deleteUnusedListingImages(sql: Sql, userId: string, urls: string[]): Promise<void> {
  for (const url of urls) {
    const match = url.match(/^\/(?:uploads\/([^/]+)|api\/mobile\/images\/([0-9a-f-]{36}))$/i);
    const storageKey = match?.[1] || match?.[2];
    if (!storageKey) continue;
    const rows = await sql.query<{ id: string }>(
      "select id from mobile_listing_images where user_id=$1 and storage_key=$2",
      [userId, storageKey],
    );
    if (!rows[0]) continue;
    await sql.query(
      `delete from mobile_listing_images i where i.id=$1 and i.user_id=$2
        and not exists (select 1 from listings l where l.images @> jsonb_build_array($3::text))`,
      [rows[0].id, userId, url],
    );
  }
}
