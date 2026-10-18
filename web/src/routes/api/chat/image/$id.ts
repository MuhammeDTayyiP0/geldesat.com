import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";

export const Route = createFileRoute("/api/chat/image/$id")({
  server: {
    handlers: {
      /** A chat photo, only for the two people in that chat. */
      GET: async ({ params }) => {
        const user = await getSessionUser();
        if (!user) return new Response(null, { status: 401 });
        const sql = await getSql();
        const rows = await sql.query<{ mime_type: string; data: Buffer }>(
          `select i.mime_type, i.data from chat_images i join conversations cv on cv.id = i.conversation_id
           where i.id = $1 and (cv.buyer_id = $2 or cv.seller_id = $2)`,
          [params.id, user.id],
        );
        if (!rows[0]) return new Response(null, { status: 404 });
        const bytes = new Uint8Array(rows[0].data.byteLength);
        bytes.set(rows[0].data);
        return new Response(bytes, {
          headers: {
            "Content-Type": rows[0].mime_type,
            "Content-Length": String(bytes.byteLength),
            "Cache-Control": "private, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
