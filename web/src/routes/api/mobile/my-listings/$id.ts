import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getMobileUserId } from "@/lib/server/mobile-auth";
import { mapListing, notify } from "@/lib/server/helpers";
import { deleteUnusedListingImages } from "@/lib/server/upload.server";
import { renewedStatus } from "@/lib/server/listing-write";
import { publicErrorMessage } from "@/lib/server/errors";

export const Route = createFileRoute("/api/mobile/my-listings/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>(
            `select l.*,c.name as category_name,c.slug as category_slug,p.phone as profile_phone,
                    coalesce((select json_agg(b.kind) from boosts b where b.listing_id=l.id and b.ends_at>now()),'[]'::json) as boosts
             from listings l join categories c on c.id=l.category_id left join profiles p on p.user_id=l.user_id
             where l.id=$1 and l.user_id=$2 limit 1`,
            [params.id,userId],
          );
          if (!rows[0]) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          return Response.json({ success: true, listing: { ...mapListing(rows[0]), phone: rows[0].phone_override ?? rows[0].profile_phone ?? "" } }, { headers: { "Cache-Control": "private, no-store" } });
        } catch (error) {
          const message = publicErrorMessage(error, "İlan yüklenemedi.");
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request, params }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const body = await request.json() as { action?: unknown; status?: unknown };
          const sql = await getSql();
          const rows = await sql.query<{ id: string; user_id: string; status: string; slug: string; images: string[]; approved_at: string | null }>("select id,user_id,status,slug,images,approved_at from listings where id=$1", [params.id]);
          if (!rows[0] || rows[0].user_id !== userId) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          if (body.action === "delete") {
            await sql.query("delete from listings where id=$1 and user_id=$2", [params.id,userId]);
            await deleteUnusedListingImages(sql, userId, rows[0].images || []);
            return Response.json({ success: true });
          }
          if (body.action === "renew") {
            if (rows[0].status === "REJECTED") return Response.json({ success: false, error: "Reddedilen ilan yenilenemez." }, { status: 400 });
            const status = renewedStatus(rows[0].status, rows[0].approved_at);
            await sql.query("update listings set expires_at=now()+interval '30 days',status=$2,updated_at=now() where id=$1 and user_id=$3", [params.id,status,userId]);
            return Response.json({ success: true });
          }
          if (body.action === "status" && ["ACTIVE","INACTIVE","SOLD"].includes(String(body.status))) {
            if ((rows[0].status === "PENDING" || rows[0].status === "REJECTED" || !rows[0].approved_at) && body.status === "ACTIVE") return Response.json({ success: false, error: "Onay bekleyen ilanı yayına alamazsınız." }, { status: 400 });
            await sql.query("update listings set status=$2,updated_at=now() where id=$1 and user_id=$3", [params.id,body.status,userId]);
            if (body.status === "ACTIVE") await notify(userId,"listing","İlanınız yayında","İlanınız tekrar yayına alındı.",`/ilan/${rows[0].slug}`);
            return Response.json({ success: true });
          }
          return Response.json({ success: false, error: "İşlem tanınmadı." }, { status: 400 });
        } catch (error) {
          const message = publicErrorMessage(error, "İlan güncellenemedi.");
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
