import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { storedImageResponse } from "@/lib/server/image-serve.server";

export const Route = createFileRoute("/api/mobile/images/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response(null, { status: 404 });
        try {
          const response = await storedImageResponse(request, params.id, async () => {
            const sql = await getSql();
            const rows = await sql.query<{ mime_type: string; data: Buffer }>(
              "select mime_type,data from mobile_listing_images where id=$1",
              [params.id],
            );
            return rows[0] ? { mimeType: rows[0].mime_type, data: rows[0].data } : null;
          });
          return response ?? new Response(null, { status: 404 });
        } catch {
          return new Response(null, { status: 500 });
        }
      },
    },
  },
});
