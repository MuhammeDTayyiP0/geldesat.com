import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getMobileUserId } from "@/lib/server/mobile-auth";
import { mapListing } from "@/lib/server/helpers";
import { ListingInput, saveListingRecord } from "@/lib/server/listing-write";
import { publicErrorMessage } from "@/lib/server/errors";

export const Route = createFileRoute("/api/mobile/my-listings")({
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
             from listings l join categories c on c.id=l.category_id where l.user_id=$1 order by l.created_at desc`,
            [userId],
          );
          return Response.json({ success: true, listings: rows.map(mapListing) }, { headers: { "Cache-Control": "private, no-store" } });
        } catch (error) {
          const message = publicErrorMessage(error, "İlanlarınız yüklenemedi.");
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "İlan vermek için giriş yapın." }, { status: 401 });
          const parsed = ListingInput.safeParse(await request.json());
          if (!parsed.success) return Response.json({ success: false, error: "İlan bilgilerini kontrol edin." }, { status: 400 });
          const result = await saveListingRecord(userId, parsed.data);
          return Response.json({ success: true, ...result });
        } catch (error) {
          const message = publicErrorMessage(error, "İlan kaydedilemedi.");
          return Response.json({ success: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
