import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { deleteUnusedListingImages, MAX_UPLOAD_BYTES, saveListingImage } from "@/lib/server/upload.server";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";
import { limitedFormData } from "@/lib/server/request-body";
import { authorizeUpload as authorize, json } from "@/lib/server/upload-auth.server";

const TOO_LARGE = "Fotoğraf en fazla 12 MB olabilir.";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      /** Multipart upload of one already-compressed listing photo (`file` field). */
      POST: async ({ request }) => {
        const auth = await authorize(request);
        if (auth instanceof Response) return auth;
        try {
          const file = (await limitedFormData(request, MAX_UPLOAD_BYTES + 64 * 1024, TOO_LARGE)).get("file");
          if (!(file instanceof File)) return json({ error: "Fotoğraf bulunamadı." }, 400);
          if (file.size > MAX_UPLOAD_BYTES) return json({ error: TOO_LARGE }, 413);
          const url = await saveListingImage(new Uint8Array(await file.arrayBuffer()), auth.userId);
          return json({ url });
        } catch (err) {
          return json({ error: publicErrorMessage(err, "Yükleme başarısız") }, errorStatus(err, 400));
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
