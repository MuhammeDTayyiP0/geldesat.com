import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { ensureProfile } from "@/lib/server/helpers";
import { newId } from "@/lib/utils";

async function sessionUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

export const Route = createFileRoute("/api/mobile/reviews")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await sessionUserId(request);
          if (!userId) return Response.json({ success: false, error: "Puan vermek için giriş yapın." }, { status: 401 });
          const body = await request.json() as { listingId?: unknown; rating?: unknown; comment?: unknown };
          const listingId = typeof body.listingId === "string" ? body.listingId : "";
          const rating = Number(body.rating);
          const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 400) : "";
          if (!listingId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
            return Response.json({ success: false, error: "İlan ve 1–5 arası puan gereklidir." }, { status: 400 });
          }
          const sql = await getSql();
          const listingRows = await sql.query<{ id: string; user_id: string }>("select id,user_id from listings where id=$1 or lower(slug)=lower($1) limit 1", [listingId]);
          if (!listingRows[0]) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          const listing = listingRows[0];
          if (listing.user_id === userId) return Response.json({ success: false, error: "Kendinizi puanlayamazsınız." }, { status: 400 });
          const conversation = await sql.query<{ id: string }>("select id from conversations where (buyer_id=$1 and seller_id=$2) or (buyer_id=$2 and seller_id=$1) limit 1", [userId, listing.user_id]);
          if (!conversation[0]) return Response.json({ success: false, error: "Yalnızca mesajlaştığınız satıcıları puanlayabilirsiniz." }, { status: 403 });
          await ensureProfile(userId);
          await sql.query("delete from reviews where seller_id=$1 and reviewer_id=$2 and listing_id=$3", [listing.user_id, userId, listing.id]);
          await sql.query("insert into reviews (id,seller_id,reviewer_id,listing_id,rating,comment) values ($1,$2,$3,$4,$5,$6)", [newId("rev"), listing.user_id, userId, listing.id, rating, comment || null]);
          return Response.json({ success: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Değerlendirme kaydedilemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
