import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getMobileUserId } from "@/lib/server/mobile-auth";
import { ensureProfile, mapListing, notify } from "@/lib/server/helpers";

export const Route = createFileRoute("/api/mobile/favorites")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>(
            `select l.*, c.name as category_name, c.slug as category_slug,
                    coalesce((select json_agg(b.kind) from boosts b where b.listing_id=l.id and b.ends_at>now()), '[]'::json) as boosts
             from favorites f join listings l on l.id=f.listing_id join categories c on c.id=l.category_id
             where f.user_id=$1 and l.status='ACTIVE' and (l.expires_at is null or l.expires_at>now())
             order by f.created_at desc`,
            [userId],
          );
          return Response.json({ success: true, listings: rows.map(mapListing) }, { headers: { "Cache-Control": "private, no-store" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Favoriler yüklenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Favorilere eklemek için giriş yapın." }, { status: 401 });
          const body = await request.json() as { listingId?: unknown };
          if (typeof body.listingId !== "string" || !body.listingId) return Response.json({ success: false, error: "İlan bilgisi geçersiz." }, { status: 400 });
          const sql = await getSql();
          await ensureProfile(userId);
          const listing = await sql.query<{ id: string; user_id: string; title: string; slug: string }>(
            "select id,user_id,title,slug from listings where id=$1 and status='ACTIVE' and (expires_at is null or expires_at>now())",
            [body.listingId],
          );
          if (!listing[0]) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          const existing = await sql.query<{ listing_id: string }>("select listing_id from favorites where user_id=$1 and listing_id=$2", [userId, body.listingId]);
          if (existing[0]) {
            await sql.query("delete from favorites where user_id=$1 and listing_id=$2", [userId, body.listingId]);
            return Response.json({ success: true, favorite: false });
          }
          await sql.query("insert into favorites (user_id,listing_id) values ($1,$2) on conflict do nothing", [userId, body.listingId]);
          if (listing[0].user_id !== userId) await notify(listing[0].user_id, "favorite", "İlanınız favorilendi", listing[0].title, `/ilan/${listing[0].slug}`);
          return Response.json({ success: true, favorite: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Favori güncellenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
