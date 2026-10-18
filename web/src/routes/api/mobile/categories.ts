import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { CategoryRow } from "@/lib/server/helpers";
import { publicErrorMessage } from "@/lib/server/errors";

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
          const countRows = await sql.query<{ category_id: string; n: number }>(
            `with recursive tree(root_id, category_id) as (
               select id, id from categories
               union all
               select tree.root_id, c.id from categories c join tree on c.parent_id=tree.category_id
             )
             select tree.root_id as category_id, count(l.id)::int as n
             from tree left join listings l on l.category_id=tree.category_id and l.status='ACTIVE'
               and (l.expires_at is null or l.expires_at>now())
             group by tree.root_id`,
          );

          return new Response(
            JSON.stringify({
              success: true,
              categories: rows,
              counts: Object.fromEntries(countRows.map((row) => [row.category_id, row.n])),
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
          const msg = publicErrorMessage(err, "Kategoriler getirilemedi");
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
