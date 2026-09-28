import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { mapListing } from "@/lib/server/helpers";

export const Route = createFileRoute("/api/mobile/stores/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>("select id,user_id,name,slug,description,city,plan from stores where lower(slug)=lower($1) limit 1", [params.slug]);
          if (!rows[0]) return Response.json({ success: false, error: "Mağaza bulunamadı." }, { status: 404 });
          const store = rows[0];
          const listings = await sql.query<Record<string, unknown>>(
            `select l.*,c.name as category_name,c.slug as category_slug,p.display_name as seller_name,
                    coalesce((select json_agg(b.kind) from boosts b where b.listing_id=l.id and b.ends_at>now()),'[]'::json) as boosts
             from listings l join categories c on c.id=l.category_id left join profiles p on p.user_id=l.user_id
             where l.store_id=$1 and l.status='ACTIVE' and (l.expires_at is null or l.expires_at>now()) order by l.created_at desc limit 24`, [store.id],
          );
          return Response.json({ success: true, store: {
            id: String(store.id), user_id: String(store.user_id), name: String(store.name), slug: String(store.slug),
            description: String(store.description ?? ""), city: String(store.city ?? ""), plan: String(store.plan),
          }, listings: listings.map(mapListing) }, { headers: { "Cache-Control": "public, max-age=30" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Mağaza yüklenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
