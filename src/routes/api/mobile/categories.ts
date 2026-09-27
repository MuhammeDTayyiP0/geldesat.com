import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { CategoryRow } from "@/lib/server/helpers";

export const Route = createFileRoute("/api/mobile/categories")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const sql = await getSql();
          const rows = await sql.query<CategoryRow>(
            `select id, name, slug, parent_id, icon, sort_order
             from categories
             order by parent_id nulls first, sort_order asc, name asc`,
          );

          return new Response(
            JSON.stringify({
              success: true,
              categories: rows,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=300",
              },
            },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Kategoriler getirilemedi";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      },
    },
  },
});
