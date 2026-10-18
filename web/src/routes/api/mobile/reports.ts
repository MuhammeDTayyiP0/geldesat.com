import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { ensureProfile, hasOpenReport, rateLimit } from "@/lib/server/helpers";
import { newId } from "@/lib/utils";
import { publicErrorMessage } from "@/lib/server/errors";

async function sessionUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

export const Route = createFileRoute("/api/mobile/reports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await sessionUserId(request);
          if (!userId) return Response.json({ success: false, error: "İlanı bildirmek için giriş yapın." }, { status: 401 });
          rateLimit(`mobile-report:${userId}`, 10, 60_000);
          const body = await request.json() as { listingId?: unknown; reason?: unknown; details?: unknown };
          const listingId = typeof body.listingId === "string" ? body.listingId : "";
          const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 80) : "";
          const details = typeof body.details === "string" ? body.details.trim().slice(0, 500) : "";
          if (!listingId || reason.length < 3) return Response.json({ success: false, error: "Bildirim nedeni seçin." }, { status: 400 });
          const sql = await getSql();
          const listing = await sql.query<{ id: string }>("select id from listings where id=$1 or lower(slug)=lower($1) limit 1", [listingId]);
          if (!listing[0]) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          await ensureProfile(userId);
          if (await hasOpenReport(sql, listing[0].id, userId)) return Response.json({ success: true });
          await sql.query("insert into reports (id,listing_id,reporter_id,reason,details) values ($1,$2,$3,$4,$5)", [newId("rep"), listing[0].id, userId, reason, details || null]);
          return Response.json({ success: true });
        } catch (error) {
          const message = publicErrorMessage(error, "Bildirim gönderilemedi.");
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
