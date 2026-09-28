import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import { mapListing } from "@/lib/server/helpers";
import { rateLimit } from "@/lib/server/helpers";

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
             where l.id=$1 or lower(l.slug)=lower($1)
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
          return Response.json({ success: true, listing, isFavorite: favoriteRows.length > 0, isOwner: userId === listing.user_id });
        } catch (error) {
          const message = error instanceof Error ? error.message : "İlan yüklenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request, params }) => {
        try {
          const userId = await sessionUserId(request);
          if (!userId) return Response.json({ success: false, error: "Telefonu görmek için giriş yapın." }, { status: 401 });
          rateLimit(`mobile-phone:${userId}`, 30, 60_000);
          const sql = await getSql();
          const rows = await sql.query<{ id: string; user_id: string; phone_override: string | null }>(
            `select l.id,l.user_id,l.phone_override from listings l
             where (l.id=$1 or lower(l.slug)=lower($1)) and l.status='ACTIVE'
               and (l.expires_at is null or l.expires_at>now()) limit 1`,
            [params.id],
          );
          if (!rows[0]) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          const profile = await sql.query<{ phone: string | null }>("select phone from profiles where user_id=$1", [rows[0].user_id]);
          const phone = rows[0].phone_override || profile[0]?.phone;
          if (!phone) return Response.json({ success: false, error: "Satıcı telefon numarası paylaşmamış." }, { status: 404 });
          await sql.query("insert into phone_reveals (listing_id, viewer_id) values ($1,$2)", [rows[0].id, userId]);
          return Response.json({ success: true, phone });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Telefon numarası alınamadı.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
