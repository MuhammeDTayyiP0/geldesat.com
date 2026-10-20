import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { mapListing } from "@/lib/server/helpers";
import { num } from "@/lib/utils";
import { publicErrorMessage } from "@/lib/server/errors";

export const Route = createFileRoute("/api/mobile/sellers/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>(
            `select p.user_id,p.display_name,p.bio,p.city,p.created_at,p.avatar_url,
                    (select count(*)::int from listings where user_id=p.user_id and status='ACTIVE' and (expires_at is null or expires_at>now())) as listing_count,
                    (select coalesce(avg(rating),0) from reviews where seller_id=p.user_id) as rating_avg,
                    (select count(*)::int from reviews where seller_id=p.user_id) as rating_count
             from profiles p where p.user_id=$1 and p.deletion_requested_at is null and p.banned_at is null limit 1`, [params.id],
          );
          if (!rows[0]) return Response.json({ success: false, error: "Satıcı bulunamadı." }, { status: 404 });
          const [stores, reviews, listings] = await Promise.all([
            sql.query<Record<string, unknown>>("select name,slug,plan,description,city,logo_url from stores where user_id=$1 limit 1", [params.id]),
            sql.query<Record<string, unknown>>(
              `select r.id,r.rating,r.comment,r.created_at,p.display_name as reviewer
               from reviews r left join profiles p on p.user_id=r.reviewer_id where r.seller_id=$1 order by r.created_at desc limit 20`, [params.id],
            ),
            sql.query<Record<string, unknown>>(
              `select l.*,c.name as category_name,c.slug as category_slug,p.display_name as seller_name,
                      coalesce((select json_agg(b.kind) from boosts b where b.listing_id=l.id and b.ends_at>now()),'[]'::json) as boosts
               from listings l join categories c on c.id=l.category_id left join profiles p on p.user_id=l.user_id
               where l.user_id=$1 and l.status='ACTIVE' and (l.expires_at is null or l.expires_at>now()) order by l.created_at desc limit 24`, [params.id],
            ),
          ]);
          const seller = rows[0];
          return Response.json({ success: true, seller: {
            id: String(seller.user_id), name: String(seller.display_name ?? "Satıcı"), bio: String(seller.bio ?? ""), city: String(seller.city ?? ""),
            avatar_url: seller.avatar_url ? String(seller.avatar_url) : null,
            since: new Date(String(seller.created_at)).toISOString(), listing_count: num(seller.listing_count), rating_avg: num(seller.rating_avg), rating_count: num(seller.rating_count),
            store: stores[0]
              ? {
                  name: String(stores[0].name),
                  slug: String(stores[0].slug),
                  plan: String(stores[0].plan),
                  description: stores[0].description ? String(stores[0].description) : null,
                  city: stores[0].city ? String(stores[0].city) : null,
                  logo: stores[0].logo_url ? String(stores[0].logo_url) : null,
                }
              : null,
            reviews: reviews.map((review) => ({ id: String(review.id), rating: num(review.rating), comment: String(review.comment ?? ""), reviewer: String(review.reviewer ?? "Üye"), at: new Date(String(review.created_at)).toISOString() })),
          }, listings: listings.map(mapListing) }, { headers: { "Cache-Control": "public, max-age=30" } });
        } catch (error) {
          const message = publicErrorMessage(error, "Satıcı profili yüklenemedi.");
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
