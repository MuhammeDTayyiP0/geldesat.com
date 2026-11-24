import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getSellerResponseStats } from "@/lib/server/chat";
import { listingSelect, mapListing } from "@/lib/server/helpers";
import { num } from "@/lib/utils";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";

export const Route = createFileRoute("/api/mobile/sellers/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          // Later pages of the seller's listings (the first comes with the profile).
          const url = new URL(request.url);
          const rawOffset = Number(url.searchParams.get("offset") ?? 0);
          const offset = Number.isInteger(rawOffset) && rawOffset > 0 ? Math.min(rawOffset, 10_000) : 0;
          const rawReviewsPage = Number(url.searchParams.get("reviewsPage") ?? 1);
          const reviewsPage = Number.isInteger(rawReviewsPage) && rawReviewsPage >= 1 ? Math.min(rawReviewsPage, 500) : 1;
          const rawReviewsLimit = Number(url.searchParams.get("reviewsLimit") ?? 20);
          const reviewsLimit = Number.isInteger(rawReviewsLimit) && rawReviewsLimit >= 1 ? Math.min(rawReviewsLimit, 50) : 20;
          const reviewsOffset = (reviewsPage - 1) * reviewsLimit;
          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>(
            `select p.user_id,p.display_name,p.bio,p.city,p.created_at,p.avatar_url,
                    (select count(*)::int from listings where user_id=p.user_id and status='ACTIVE' and (expires_at is null or expires_at>now())) as listing_count,
                    (select coalesce(avg(rating),0) from reviews where seller_id=p.user_id) as rating_avg,
                    (select count(*)::int from reviews where seller_id=p.user_id) as rating_count
             from profiles p where p.user_id=$1 and p.deletion_requested_at is null and p.banned_at is null limit 1`, [params.id],
          );
          if (!rows[0]) return Response.json({ success: false, error: "Satıcı bulunamadı." }, { status: 404 });
          const [stores, reviewRows, listings, responseStats] = await Promise.all([
            sql.query<Record<string, unknown>>("select name,slug,plan,description,city,logo_url from stores where user_id=$1 limit 1", [params.id]),
            sql.query<Record<string, unknown>>(
              `select r.id,r.rating,r.comment,r.created_at,p.display_name as reviewer
               from reviews r left join profiles p on p.user_id=r.reviewer_id where r.seller_id=$1 order by r.created_at desc limit $2 offset $3`,
              [params.id, reviewsLimit + 1, reviewsOffset],
            ),
            sql.query<Record<string, unknown>>(
              `select ${listingSelect("", true)},
                      coalesce((select json_agg(b.kind) from boosts b where b.listing_id=l.id and b.ends_at>now()),'[]'::json) as boosts
               from listings l join categories c on c.id=l.category_id left join profiles p on p.user_id=l.user_id left join stores s on s.id=l.store_id
               where l.user_id=$1 and l.status='ACTIVE' and (l.expires_at is null or l.expires_at>now()) order by l.created_at desc limit 24 offset $2`, [params.id, offset],
            ),
            getSellerResponseStats(sql, params.id),
          ]);
          const hasMoreReviews = reviewRows.length > reviewsLimit;
          const reviews = reviewRows.slice(0, reviewsLimit);
          const seller = rows[0];
          return Response.json({ success: true, hasMoreReviews, seller: {
            id: String(seller.user_id), name: String(seller.display_name ?? "Satıcı"), bio: String(seller.bio ?? ""), city: String(seller.city ?? ""),
            avatar_url: seller.avatar_url ? String(seller.avatar_url) : null,
            since: new Date(String(seller.created_at)).toISOString(), listing_count: num(seller.listing_count), rating_avg: num(seller.rating_avg), rating_count: num(seller.rating_count),
            responseStats,
            hasMoreReviews,
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
          return Response.json({ success: false, error: message }, { status: errorStatus(error, 500) });
        }
      },
    },
  },
});
