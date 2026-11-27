import { randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/helpers";
import { evictImageVariants } from "@/lib/server/image-serve.server";
import { limitedFormData } from "@/lib/server/request-body";
import { authorizeUpload, json } from "@/lib/server/upload-auth.server";
import { assertImageBytes, MAX_UPLOAD_BYTES } from "@/lib/server/upload.server";

export const Route = createFileRoute("/api/store-logo")({
  server: {
    handlers: {
      /** Replace the signed-in store owner's logo (`file` field); returns `{ url }`. */
      POST: async ({ request }) => {
        const auth = await authorizeUpload(request);
        if (auth instanceof Response) return auth;
        try {
          rateLimit(`store-logo:${auth.userId}`, 10, 10 * 60_000);
          const sql = await getSql();
          const stores = await sql.query<{ id: string; logo_url: string | null }>(
            "select id, logo_url from stores where user_id=$1 limit 1",
            [auth.userId],
          );
          if (!stores[0]) return json({ error: "Mağaza bulunamadı." }, 403);
          const file = (
            await limitedFormData(request, MAX_UPLOAD_BYTES + 64 * 1024, "Fotoğraf en fazla 12 MB olabilir.")
          ).get("file");
          if (!(file instanceof File)) return json({ error: "Fotoğraf bulunamadı." }, 400);
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { isHeif, processAvatar } = await import("@/lib/server/image-pipeline.server");
          if (!isHeif(bytes)) assertImageBytes(bytes, MAX_UPLOAD_BYTES);
          let data: Buffer;
          try {
            data = await processAvatar(bytes);
          } catch (err) {
            console.error("[store-logo] processing failed", err);
            throw new Error("Fotoğraf işlenemedi. Farklı bir fotoğraf deneyin.");
          }
          const storeId = stores[0].id;
          const storageKey = `store_${storeId}_${Date.now()}_${randomUUID().slice(0, 8)}.webp`;
          const url = `/uploads/${storageKey}`;
          const evictedKey = await sql.transaction(async (tx) => {
            const locked = await tx.query<{ id: string; logo_url: string | null }>(
              "select id, logo_url from stores where id=$1 for update",
              [storeId],
            );
            const oldKey = locked[0]?.logo_url?.match(/^\/uploads\/(store_[^/]+)$/)?.[1] ?? null;
            await tx.query(
              "insert into mobile_listing_images (id,user_id,storage_key,mime_type,data) values ($1,$2,$3,'image/webp',$4)",
              [randomUUID(), auth.userId, storageKey, data],
            );
            await tx.query("update stores set logo_url=$2 where id=$1", [storeId, url]);
            if (oldKey) {
              await tx.query("delete from mobile_listing_images where user_id=$1 and storage_key=$2", [
                auth.userId,
                oldKey,
              ]);
            }
            return oldKey;
          });
          if (evictedKey) evictImageVariants([evictedKey]);
          return json({ url });
        } catch (err) {
          return json({ error: publicErrorMessage(err, "Logo yüklenemedi.") }, errorStatus(err, 400));
        }
      },
      /** Remove the signed-in store owner's logo. */
      DELETE: async ({ request }) => {
        const auth = await authorizeUpload(request);
        if (auth instanceof Response) return auth;
        try {
          rateLimit(`store-logo-del:${auth.userId}`, 20, 10 * 60_000);
          const sql = await getSql();
          const evictedKey = await sql.transaction(async (tx) => {
            const stores = await tx.query<{ id: string; logo_url: string | null }>(
              "select id, logo_url from stores where user_id=$1 limit 1 for update",
              [auth.userId],
            );
            if (!stores[0]) return undefined;
            const oldKey = stores[0].logo_url?.match(/^\/uploads\/(store_[^/]+)$/)?.[1] ?? null;
            await tx.query("update stores set logo_url=null where id=$1", [stores[0].id]);
            if (oldKey) {
              await tx.query("delete from mobile_listing_images where user_id=$1 and storage_key=$2", [
                auth.userId,
                oldKey,
              ]);
            }
            return oldKey;
          });
          if (evictedKey === undefined) return json({ error: "Mağaza bulunamadı." }, 404);
          if (evictedKey) evictImageVariants([evictedKey]);
          return json({ ok: true });
        } catch (err) {
          return json({ error: publicErrorMessage(err, "Logo kaldırılamadı.") }, errorStatus(err, 400));
        }
      },
    },
  },
});
