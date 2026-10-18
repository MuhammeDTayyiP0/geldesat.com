import { randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getMobileUserId } from "@/lib/server/mobile-auth";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const Route = createFileRoute("/api/mobile/images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getMobileUserId(request);
        if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });

        try {
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) return Response.json({ success: false, error: "Fotoğraf bulunamadı." }, { status: 400 });
          if (!ALLOWED_TYPES.has(file.type)) return Response.json({ success: false, error: "JPEG, PNG veya WebP fotoğraf yükleyin." }, { status: 415 });
          if (file.size < 1 || file.size > MAX_IMAGE_BYTES) return Response.json({ success: false, error: "Fotoğraf en fazla 2 MB olabilir." }, { status: 413 });

          const id = randomUUID();
          const bytes = Buffer.from(await file.arrayBuffer());
          const sql = await getSql();
          await sql.query(
            "insert into mobile_listing_images (id,user_id,storage_key,mime_type,data) values ($1,$2,$1,$3,$4)",
            [id, userId, file.type, bytes],
          );
          return Response.json({ success: true, url: `/api/mobile/images/${id}` });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Fotoğraf yüklenemedi.";
          return Response.json({ success: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
