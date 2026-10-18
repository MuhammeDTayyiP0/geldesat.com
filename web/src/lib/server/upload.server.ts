import { randomUUID } from "node:crypto";
import { getSql, type Sql } from "@/lib/db";

const DATA_URL_REGEX = /^data:image\/(webp|jpeg|jpg|png);base64,(.+)$/i;

/**
 * Store web uploads in Postgres so image URLs survive serverless restarts.
 * The public URL path stays `/uploads/<filename>` for existing web clients.
 */
export async function saveImageToDisk(dataUrl: string, userId: string): Promise<string> {
  const match = dataUrl.match(DATA_URL_REGEX);
  if (!match) {
    throw new Error("Geçersiz görsel verisi. WebP, JPEG veya PNG bekleniyor.");
  }

  let ext = match[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");

  // En fazla 2 MB sınır
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error("Görsel boyutu 2 MB sınırını aşıyor.");
  }

  const filename = `${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 10)}.${ext}`;
  const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
  const id = randomUUID();
  const sql = await getSql();
  await sql.query(
    "insert into mobile_listing_images (id,user_id,storage_key,mime_type,data) values ($1,$2,$3,$4,$5)",
    [id, userId, filename, mimeType, buffer],
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
