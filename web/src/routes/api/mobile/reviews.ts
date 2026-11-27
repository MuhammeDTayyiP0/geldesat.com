import { createFileRoute } from "@tanstack/react-router";
import { readJson } from "@/lib/server/request-body";
import { getSql } from "@/lib/db";
import { assertMobileJsonWrite, getMobileUserId } from "@/lib/server/mobile-auth";
import { canReviewSeller, ensureProfile, REVIEW_NOT_ELIGIBLE, saveReview } from "@/lib/server/helpers";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";

export const Route = createFileRoute("/api/mobile/reviews")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const csrfError = assertMobileJsonWrite(request);
          if (csrfError) return csrfError;
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Puan vermek için giriş yapın." }, { status: 401 });
          const body = (await readJson(request)) as { listingId?: unknown; rating?: unknown; comment?: unknown };
          const listingId = typeof body.listingId === "string" ? body.listingId : "";
          const rating = typeof body.rating === "number" ? body.rating : NaN;
          const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 400) : "";
          if (!listingId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
            return Response.json({ success: false, error: "İlan ve 1–5 arası puan gereklidir." }, { status: 400 });
          }
          const sql = await getSql();
          const listingRows = await sql.query<{ id: string; user_id: string }>("select id,user_id from listings where id=$1 or lower(slug)=lower($1) limit 1", [listingId]);
          if (!listingRows[0]) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          const listing = listingRows[0];
          if (listing.user_id === userId) return Response.json({ success: false, error: "Kendinizi puanlayamazsınız." }, { status: 400 });
          if (!(await canReviewSeller(sql, userId, listing.user_id))) return Response.json({ success: false, error: REVIEW_NOT_ELIGIBLE }, { status: 403 });
          await ensureProfile(userId);
          await saveReview(sql, userId, listing.user_id, listing.id, rating, comment || null);
          return Response.json({ success: true });
        } catch (error) {
          const message = publicErrorMessage(error, "Değerlendirme kaydedilemedi.");
          return Response.json({ success: false, error: message }, { status: errorStatus(error, 500) });
        }
      },
    },
  },
});
