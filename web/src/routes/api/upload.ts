import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { deleteUnusedListingImages, MAX_UPLOAD_BYTES, saveListingImage } from "@/lib/server/upload.server";
import { getSessionUser } from "@/lib/auth/verify.server";
import { publicErrorMessage } from "@/lib/server/errors";
import { UPLOAD_HEADER } from "@/lib/listing-photos";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Session user for a same-site upload request, or an error response. */
async function authorize(request: Request): Promise<{ userId: string } | Response> {
  if (request.headers.get(UPLOAD_HEADER) !== "1" || request.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "Geçersiz istek" }, 403);
  }
  const user = await getSessionUser();
  if (!user) return json({ error: "Giriş yapmalısınız" }, 401);
  return { userId: user.id };
}

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      /** Multipart upload of one already-compressed listing photo (`file` field). */
      POST: async ({ request }) => {
        const auth = await authorize(request);
        if (auth instanceof Response) return auth;
        const length = Number(request.headers.get("content-length") ?? 0);
        if (length > MAX_UPLOAD_BYTES + 64 * 1024) return json({ error: "Fotoğraf en fazla 12 MB olabilir." }, 413);
        try {
          const file = (await request.formData()).get("file");
          if (!(file instanceof File)) return json({ error: "Fotoğraf bulunamadı." }, 400);
          if (file.size > MAX_UPLOAD_BYTES) return json({ error: "Fotoğraf en fazla 12 MB olabilir." }, 413);
          const url = await saveListingImage(new Uint8Array(await file.arrayBuffer()), auth.userId);
          return json({ url });
        } catch (err) {
          return json({ error: publicErrorMessage(err, "Yükleme başarısız") }, 400);
        }
      },
      /** Drop a photo the user removed before saving; photos used by any listing are kept. */
      DELETE: async ({ request }) => {
        const auth = await authorize(request);
        if (auth instanceof Response) return auth;
        try {
          const { url } = (await request.json()) as { url?: unknown };
          if (typeof url !== "string" || url.length > 200) return json({ error: "Geçersiz istek" }, 400);
          await deleteUnusedListingImages(await getSql(), auth.userId, [url]);
          return json({ ok: true });
        } catch (err) {
          return json({ error: publicErrorMessage(err, "Silinemedi") }, 400);
        }
      },
    },
  },
});
