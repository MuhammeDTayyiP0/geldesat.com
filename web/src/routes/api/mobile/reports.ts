import { createFileRoute } from "@tanstack/react-router";
import { readJson } from "@/lib/server/request-body";
import { getSql } from "@/lib/db";
import { assertMobileJsonWrite, getMobileUserId } from "@/lib/server/mobile-auth";
import { ensureProfile, hasOpenReport, insertListingReport, rateLimit } from "@/lib/server/helpers";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";
import { listingNoFromSlug } from "@/lib/utils";

export const Route = createFileRoute("/api/mobile/reports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const csrfError = assertMobileJsonWrite(request);
          if (csrfError) return csrfError;
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "İlanı bildirmek için giriş yapın." }, { status: 401 });
          rateLimit(`mobile-report:${userId}`, 10, 60_000);
          const body = (await readJson(request)) as { listingId?: unknown; reason?: unknown; details?: unknown };
          const listingId = typeof body.listingId === "string" ? body.listingId : "";
          const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 80) : "";
          const details = typeof body.details === "string" ? body.details.trim().slice(0, 500) : "";
          if (!listingId || reason.length < 3) return Response.json({ success: false, error: "Bildirim nedeni seçin." }, { status: 400 });
          const sql = await getSql();
          const listingNo = listingNoFromSlug(listingId);
          const listing = await sql.query<{ id: string; user_id: string }>(
            `select id, user_id from listings
             where (${listingNo ? "listing_no = $1::bigint" : "id=$1 or lower(slug)=lower($1) or lower(legacy_slug)=lower($1)"})
               and status in ('ACTIVE', 'SOLD')
             limit 1`,
            [listingNo ? String(listingNo) : listingId],
          );
          if (!listing[0]) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          if (listing[0].user_id === userId) {
            return Response.json({ success: false, error: "Kendi ilanınızı bildiremezsiniz." }, { status: 400 });
          }
          await ensureProfile(userId);
          if (await hasOpenReport(sql, listing[0].id, userId)) return Response.json({ success: true });
          await insertListingReport(sql, listing[0].id, userId, reason, details || null);
          return Response.json({ success: true });
        } catch (error) {
          const message = publicErrorMessage(error, "Bildirim gönderilemedi.");
          return Response.json({ success: false, error: message }, { status: errorStatus(error, 500) });
        }
      },
    },
  },
});
