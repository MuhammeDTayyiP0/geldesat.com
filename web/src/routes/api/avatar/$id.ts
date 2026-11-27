import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/avatar/$id")({
  server: {
    handlers: {
      /** Public profile photo. Versioned URLs (?v=...) are immutable; unversioned ones revalidate hourly. */
      GET: async ({ params, request }) => {
        try {
          const sql = await getSql();
          const rows = await sql.query<{ mime_type: string; data: Buffer; avatar_url: string | null }>(
            `select a.mime_type, a.data, p.avatar_url
             from user_avatars a
             join profiles p on p.user_id = a.user_id
             where a.user_id=$1 and p.banned_at is null and p.deletion_requested_at is null`,
            [params.id],
          );
          if (!rows[0]) return new Response(null, { status: 404 });
          const bytes = new Uint8Array(rows[0].data.byteLength);
          bytes.set(rows[0].data);
          const reqV = new URL(request.url).searchParams.get("v");
          const storedV = rows[0].avatar_url?.match(/[?&]v=([^&]+)/)?.[1] ?? null;
          const versionMatched = Boolean(reqV && storedV && reqV === storedV);
          return new Response(bytes, {
            headers: {
              "Content-Type": rows[0].mime_type,
              "Content-Length": String(bytes.byteLength),
              "Cache-Control": versionMatched
                ? "public, max-age=31536000, immutable"
                : "public, max-age=300, stale-while-revalidate=86400",
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
