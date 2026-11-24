import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/avatar/$id")({
  server: {
    handlers: {
      /** Public profile photo. Versioned URLs (?v=...) are immutable; unversioned ones revalidate hourly. */
      GET: async ({ params, request }) => {
        try {
          const sql = await getSql();
          const rows = await sql.query<{ mime_type: string; data: Buffer }>(
            "select mime_type, data from user_avatars where user_id=$1",
            [params.id],
          );
          if (!rows[0]) return new Response(null, { status: 404 });
          const bytes = new Uint8Array(rows[0].data.byteLength);
          bytes.set(rows[0].data);
          const hasVersion = new URL(request.url).searchParams.has("v");
          return new Response(bytes, {
            headers: {
              "Content-Type": rows[0].mime_type,
              "Content-Length": String(bytes.byteLength),
              "Cache-Control": hasVersion
                ? "public, max-age=31536000, immutable"
                : "public, max-age=3600, stale-while-revalidate=86400",
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
