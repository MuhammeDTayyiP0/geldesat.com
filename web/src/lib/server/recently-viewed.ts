import { getSql } from "@/lib/db";
import { listingSelect, mapListing, type ListingCard } from "./helpers";

/** How many recently viewed listings an account keeps. */
export const RECENT_LIMIT = 50;

export type RecentListing = ListingCard & { viewed_at: string; live: boolean };

/** Note that a signed-in user opened a listing (not their own), keeping only the latest 50. */
export async function recordListingView(userId: string, listingId: string): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into listing_views (user_id, listing_id, viewed_at)
     select $1, l.id, now() from listings l where l.id = $2 and l.user_id <> $1
     on conflict (user_id, listing_id) do update set viewed_at = now()`,
    [userId, listingId],
  );
  await sql.query(
    `delete from listing_views where user_id = $1 and listing_id not in (
       select listing_id from listing_views where user_id = $1 order by viewed_at desc limit $2)`,
    [userId, RECENT_LIMIT],
  );
}

/** The user's recently viewed listings, newest first. `live` is false once a listing is off the air. */
export async function recentListings(userId: string, limit = RECENT_LIMIT): Promise<RecentListing[]> {
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select ${listingSelect("", true)}, v.viewed_at,
            (l.status = 'ACTIVE' and (l.expires_at is null or l.expires_at > now())) as live,
            coalesce((select json_agg(b.kind) from boosts b where b.listing_id = l.id and b.ends_at > now()), '[]'::json) as boosts
     from listing_views v
     join listings l on l.id = v.listing_id
     join categories c on c.id = l.category_id
     left join profiles p on p.user_id = l.user_id
     left join stores s on s.id = l.store_id
     where v.user_id = $1
     order by v.viewed_at desc
     limit $2`,
    [userId, Math.min(Math.max(limit, 1), RECENT_LIMIT)],
  );
  return rows.map((row) => ({ ...mapListing(row), viewed_at: String(row.viewed_at), live: Boolean(row.live) }));
}

/** Remove one listing from the history, or all of it when `listingId` is null. */
export async function clearRecent(userId: string, listingId: string | null): Promise<void> {
  const sql = await getSql();
  if (listingId) await sql.query("delete from listing_views where user_id = $1 and listing_id = $2", [userId, listingId]);
  else await sql.query("delete from listing_views where user_id = $1", [userId]);
}
