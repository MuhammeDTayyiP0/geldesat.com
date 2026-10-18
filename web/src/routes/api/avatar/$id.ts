import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/avatar/$id")({
  server: {
    handlers: {
      /** Public profile photo. URLs carry ?v=<version>, so responses can be cached forever. */
      GET: async ({ params }) => {
        try {
          const sql = await getSql();
          const rows = await sql.query<{ mime_type: string; data: Buffer }>(
            "select mime_type, data from user_avatars where user_id=$1",
            [params.id],
          );
          if (!rows[0]) return new Response(null, { status: 404 });
          const bytes = new Uint8Array(rows[0].data.byteLength);
          bytes.set(rows[0].data);
          return new Response(bytes, {
            headers: {
              "Content-Type": rows[0].mime_type,
              "Content-Length": String(bytes.byteLength),
              "Cache-Control": "public, max-age=31536000, immutable",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch {
          return new Response(null, { status: 500 });
        }
      },
    },
  },
});
