import { isExpired, ownerActions } from "@/lib/listing-status";
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { readJson } from "@/lib/server/request-body";
import { assertMobileJsonWrite, getMobileUserId } from "@/lib/server/mobile-auth";
import { listingSelect, mapListing } from "@/lib/server/helpers";
import { ListingInput, saveListingRecord } from "@/lib/server/listing-write";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";

export const Route = createFileRoute("/api/mobile/my-listings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>(
            `select ${listingSelect("", true)}, l.rejection_reason, (l.approved_at is not null) as approved,
                    (select count(*)::int from favorites f where f.listing_id=l.id) as fav_count,
                    (select count(*)::int from conversations cv where cv.listing_id=l.id) as message_count,
                    (select count(distinct pr.viewer_id)::int from phone_reveals pr where pr.listing_id=l.id) as phone_reveal_count,
                    coalesce((select json_agg(b.kind) from boosts b where b.listing_id=l.id and b.ends_at>now()), '[]'::json) as boosts
             from listings l join categories c on c.id=l.category_id left join profiles p on p.user_id=l.user_id left join stores s on s.id=l.store_id
             where l.user_id=$1 order by l.created_at desc limit 500`,
            [userId],
          );
          return Response.json({ success: true, listings: rows.map((row) => {
            const listing = mapListing(row);
            // The app shows exactly what the server would accept.
            return {
              ...listing,
              rejection_reason: row.rejection_reason ? String(row.rejection_reason) : null,
              fav_count: Number(row.fav_count ?? 0),
              message_count: Number(row.message_count ?? 0),
              phone_reveal_count: Number(row.phone_reveal_count ?? 0),
              ownerActions: ownerActions({ status: listing.status, approved: Boolean(row.approved), expired: isExpired(listing.expires_at) }),
            };
          }) }, { headers: { "Cache-Control": "private, no-store" } });
        } catch (error) {
          const message = publicErrorMessage(error, "İlanlarınız yüklenemedi.");
          return Response.json({ success: false, error: message }, { status: errorStatus(error, 500) });
        }
      },
      POST: async ({ request }) => {
        try {
          const csrfError = assertMobileJsonWrite(request);
          if (csrfError) return csrfError;
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "İlan vermek için giriş yapın." }, { status: 401 });
          const parsed = ListingInput.safeParse(await readJson(request));
          if (!parsed.success) return Response.json({ success: false, error: "İlan bilgilerini kontrol edin." }, { status: 400 });
          const result = await saveListingRecord(userId, parsed.data);
          return Response.json({ success: true, ...result });
        } catch (error) {
          const message = publicErrorMessage(error, "İlan kaydedilemedi.");
          return Response.json({ success: false, error: message }, { status: errorStatus(error, 400) });
        }
      },
    },
  },
});
