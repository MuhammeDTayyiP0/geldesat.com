import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getMobileUserId } from "@/lib/server/mobile-auth";

export const Route = createFileRoute("/api/mobile/images/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response(null, { status: 404 });
        try {
          const sql = await getSql();
          const rows = await sql.query<{ mime_type: string; data: Buffer }>(
            "select mime_type,data from mobile_listing_images where id=$1",
            [params.id],
          );
          const image = rows[0];
          if (!image) return new Response(null, { status: 404 });
          return new Response(new Uint8Array(image.data), {
            headers: {
              "Content-Type": image.mime_type,
              "Content-Length": String(image.data.byteLength),
              "Cache-Control": "public, max-age=31536000, immutable",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch {
          return new Response(null, { status: 500 });
        }
      },
      DELETE: async ({ request, params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return Response.json({ success: false, error: "Fotoğraf bulunamadı." }, { status: 404 });
        const userId = await getMobileUserId(request);
        if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
        const sql = await getSql();
        const imageUrl = `/api/mobile/images/${params.id}`;
        const referenced = await sql.query<{ exists: boolean }>(
          "select exists(select 1 from listings where images @> jsonb_build_array($1::text)) as exists",
          [imageUrl],
        );
        if (referenced[0]?.exists) return Response.json({ success: false, error: "Yayındaki ilan fotoğrafı olarak kullanılıyor." }, { status: 409 });
        const deleted = await sql.query<{ id: string }>(
          "delete from mobile_listing_images where id=$1 and user_id=$2 returning id",
          [params.id, userId],
        );
        return deleted.length
          ? Response.json({ success: true })
          : Response.json({ success: false, error: "Fotoğraf bulunamadı." }, { status: 404 });
      },
    },
  },
});
