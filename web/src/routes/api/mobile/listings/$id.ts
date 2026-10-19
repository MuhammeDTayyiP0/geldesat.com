import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import { canReviewSeller, firstInWindow, mapListing, rateLimit, revealListingPhone, viewerKey } from "@/lib/server/helpers";
import { publicErrorMessage } from "@/lib/server/errors";

async function sessionUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

export const Route = createFileRoute("/api/mobile/listings/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>(
            `select l.*, c.name as category_name, c.slug as category_slug,
                    p.display_name as seller_name, s.name as store_name, s.slug as store_slug,
                    coalesce((select json_agg(b.kind) from boosts b where b.listing_id=l.id and b.ends_at>now()), '[]'::json) as boosts
             from listings l
             join categories c on c.id=l.category_id
             left join profiles p on p.user_id=l.user_id
             left join stores s on s.id=l.store_id
             where l.id=$1 or lower(l.slug)=lower($1) or ($1 ~ '^[0-9]{7,15}$' and l.listing_no::text=$1)
             limit 1`,
            [params.id],
          );
          if (!rows[0]) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          const listing = mapListing(rows[0]);
          const userId = await sessionUserId(request);
          const live = listing.status === "ACTIVE" && (!listing.expires_at || new Date(listing.expires_at).getTime() > Date.now());
          if (!live && userId !== listing.user_id) {
            return Response.json({ success: false, error: "İlan yayında değil." }, { status: 404 });
          }
          const favoriteRows = userId
            ? await sql.query<{ listing_id: string }>("select listing_id from favorites where user_id=$1 and listing_id=$2", [userId, listing.id])
            : [];
          const [history, similarRows, reviews, stats] = await Promise.all([
            sql.query<{ price: number | string; recorded_at: string }>("select price,recorded_at from price_history where listing_id=$1 order by recorded_at asc", [listing.id]),
            sql.query<Record<string, unknown>>(
              `select l.*,c.name as category_name,c.slug as category_slug,p.display_name as seller_name,
                      coalesce((select json_agg(b.kind) from boosts b where b.listing_id=l.id and b.ends_at>now()),'[]'::json) as boosts
               from listings l join categories c on c.id=l.category_id left join profiles p on p.user_id=l.user_id
               where l.category_id=$1 and l.id<>$2 and l.status='ACTIVE' and (l.expires_at is null or l.expires_at>now())
               order by l.created_at desc limit 4`, [listing.category_id, listing.id],
            ),
            sql.query<Record<string, unknown>>(
              `select r.id,r.rating,r.comment,r.created_at,p.display_name as reviewer
               from reviews r left join profiles p on p.user_id=r.reviewer_id where r.seller_id=$1 order by r.created_at desc limit 6`, [listing.user_id],
            ),
            sql.query<{ favorite_count: number; phone_reveal_count: number; rating_avg: number; rating_count: number }>(
              `select
                (select count(*)::int from favorites where listing_id=$1) as favorite_count,
                (select count(*)::int from phone_reveals where listing_id=$1) as phone_reveal_count,
                (select coalesce(avg(rating),0) from reviews where seller_id=$2) as rating_avg,
                (select count(*)::int from reviews where seller_id=$2) as rating_count`, [listing.id, listing.user_id],
            ),
          ]);
          const sellerReviewEligible = Boolean(userId && userId !== listing.user_id && (await canReviewSeller(sql, userId, listing.user_id)));
          const existingReview = userId && userId !== listing.user_id
            ? await sql.query<{ rating: number; comment: string | null }>(
                "select rating,comment from reviews where seller_id=$1 and reviewer_id=$2 and listing_id=$3 limit 1", [listing.user_id, userId, listing.id],
              )
            : [];
          const metric = stats[0];
          // One view per visitor and listing every 30 minutes; owners do not count.
          const countView = userId !== listing.user_id && firstInWindow(`view:${listing.id}:${viewerKey(request.headers, userId)}`, 30 * 60_000);
          const enrichedListing = { ...listing, view_count: Number(listing.view_count || 0) + (countView ? 1 : 0) };
          if (countView) await sql.query("update listings set view_count=view_count+1 where id=$1", [listing.id]);
          return Response.json({
            success: true,
            listing: enrichedListing,
            isFavorite: favoriteRows.length > 0,
            isOwner: userId === listing.user_id,
            history: history.map((row) => ({ price: Number(row.price), at: String(row.recorded_at) })),
            similar: similarRows.map(mapListing),
            reviews: reviews.map((row) => ({ id: String(row.id), rating: Number(row.rating), comment: String(row.comment ?? ''), reviewer: String(row.reviewer ?? 'Üye'), at: String(row.created_at) })),
            sellerStats: { rating_avg: Number(metric?.rating_avg || 0), rating_count: Number(metric?.rating_count || 0) },
            favoriteCount: Number(metric?.favorite_count || 0),
            phoneRevealCount: Number(metric?.phone_reveal_count || 0),
            reviewEligibility: { eligible: sellerReviewEligible, existing: existingReview[0] ? { rating: Number(existingReview[0].rating), comment: existingReview[0].comment } : null },
          });
        } catch (error) {
          const message = publicErrorMessage(error, "İlan yüklenemedi.");
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request, params }) => {
        try {
          const userId = await sessionUserId(request);
          rateLimit(`mobile-phone:${viewerKey(request.headers, userId)}`, 30, 60_000);
          let phone: string;
          try {
            phone = await revealListingPhone(params.id, userId ?? null);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Telefon numarası alınamadı.";
            const status = /giriş yapın/.test(message) ? 401 : 404;
            return Response.json({ success: false, error: message }, { status });
          }
          return Response.json({ success: true, phone });
        } catch (error) {
          const message = publicErrorMessage(error, "Telefon numarası alınamadı.");
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
