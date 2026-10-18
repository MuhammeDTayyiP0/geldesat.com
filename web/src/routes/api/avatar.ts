import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { publicErrorMessage } from "@/lib/server/errors";
import { ensureProfile } from "@/lib/server/helpers";
import { assertImageBytes, MAX_UPLOAD_BYTES } from "@/lib/server/upload.server";
import { authorizeUpload, json } from "@/lib/server/upload-auth.server";

export const Route = createFileRoute("/api/avatar")({
  server: {
    handlers: {
      /** Replace the signed-in user's profile photo (`file` field); returns its versioned URL. */
      POST: async ({ request }) => {
        const auth = await authorizeUpload(request);
        if (auth instanceof Response) return auth;
        if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) {
          return json({ error: "Fotoğraf en fazla 12 MB olabilir." }, 413);
        }
        try {
          const file = (await request.formData()).get("file");
          if (!(file instanceof File)) return json({ error: "Fotoğraf bulunamadı." }, 400);
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { isHeif, processAvatar } = await import("@/lib/server/image-pipeline.server");
          if (!isHeif(bytes)) assertImageBytes(bytes, MAX_UPLOAD_BYTES);
          let data: Buffer;
          try {
            data = await processAvatar(bytes);
          } catch (err) {
            console.error("[avatar] processing failed", err);
            throw new Error("Fotoğraf işlenemedi. Farklı bir fotoğraf deneyin.");
          }
          const sql = await getSql();
          await ensureProfile(auth.userId);
          await sql.query(
            `insert into user_avatars (user_id, mime_type, data, updated_at) values ($1,'image/webp',$2,now())
             on conflict (user_id) do update set data=excluded.data, updated_at=now()`,
            [auth.userId, data],
          );
          const url = `/api/avatar/${encodeURIComponent(auth.userId)}?v=${Date.now().toString(36)}`;
          await sql.query("update profiles set avatar_url=$2 where user_id=$1", [auth.userId, url]);
          return json({ url });
        } catch (err) {
          return json({ error: publicErrorMessage(err, "Fotoğraf yüklenemedi") }, 400);
        }
      },
      /** Remove the profile photo. */
      DELETE: async ({ request }) => {
        const auth = await authorizeUpload(request);
        if (auth instanceof Response) return auth;
        const sql = await getSql();
        await sql.query("delete from user_avatars where user_id=$1", [auth.userId]);
        await sql.query("update profiles set avatar_url=null where user_id=$1", [auth.userId]);
        return json({ ok: true });
      },
    },
  },
});
