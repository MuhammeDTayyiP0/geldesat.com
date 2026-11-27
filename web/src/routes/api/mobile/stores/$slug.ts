import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { listingSelect, mapListing } from "@/lib/server/helpers";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";

export const Route = createFileRoute("/api/mobile/stores/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const url = new URL(request.url);
          const rawLimit = Number(url.searchParams.get("limit") ?? 24);
          const rawOffset = Number(url.searchParams.get("offset") ?? 0);
          const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 48) : 24;
          const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? Math.min(rawOffset, 100_000) : 0;

          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>(
            `select s.id,s.user_id,s.name,s.slug,s.description,s.city,s.plan,s.logo_url
             from stores s join profiles p on p.user_id=s.user_id
             where lower(s.slug)=lower($1) and p.deletion_requested_at is null and p.banned_at is null limit 1`,
            [params.slug],
          );
          if (!rows[0]) return Response.json({ success: false, error: "Mağaza bulunamadı." }, { status: 404 });
          const store = rows[0];
          const [listings, totalRows] = await Promise.all([
            sql.query<Record<string, unknown>>(
              `select ${listingSelect("", true)},
                      coalesce((select json_agg(b.kind) from boosts b where b.listing_id=l.id and b.ends_at>now()),'[]'::json) as boosts
               from listings l
               join categories c on c.id=l.category_id
               left join profiles p on p.user_id=l.user_id
               left join stores s on s.id=l.store_id
               where l.store_id=$1 and l.status='ACTIVE' and (l.expires_at is null or l.expires_at>now())
               order by l.created_at desc limit $2 offset $3`,
              [store.id, limit, offset],
            ),
            sql.query<{ total: number }>(
              `select count(*)::int as total from listings l
               where l.store_id=$1 and l.status='ACTIVE' and (l.expires_at is null or l.expires_at>now())`,
              [store.id],
            ),
          ]);
          const total = Number(totalRows[0]?.total ?? 0);
          return Response.json(
            {
              success: true,
              store: {
                id: String(store.id),
                user_id: String(store.user_id),
                name: String(store.name),
                slug: String(store.slug),
                description: String(store.description ?? ""),
                city: String(store.city ?? ""),
                plan: String(store.plan),
                logo: store.logo_url ? String(store.logo_url) : null,
                listing_count: total,
              },
              total,
              limit,
              offset,
              listings: listings.map(mapListing),
            },
            { headers: { "Cache-Control": "public, max-age=30" } },
          );
        } catch (error) {
          const message = publicErrorMessage(error, "Mağaza yüklenemedi.");
          return Response.json({ success: false, error: message }, { status: errorStatus(error, 500) });
        }
      },
    },
  },
});
