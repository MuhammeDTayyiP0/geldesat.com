import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSessionUser } from "@/lib/auth/verify.server";
import { getSql, type Sql } from "@/lib/db";
import { asIso, num } from "@/lib/utils";
import { ensureProfile, notify, rateLimit } from "./helpers";

type QuerySql = Pick<Sql, "query">;

export type FollowedSellerSummary = {
  id: string;
  name: string;
  avatar: string | null;
  city: string | null;
  store_name: string | null;
  store_slug: string | null;
  active_count: number;
  followed_at: string;
};

/** Follow a seller; idempotent and rejects self-follows or closed/banned sellers. */
export async function followSellerRecord(
  sql: QuerySql,
  followerId: string,
  sellerId: string,
): Promise<{ following: boolean; followers: number }> {
  if (followerId === sellerId) throw new Error("Kendinizi takip edemezsiniz.");
  rateLimit(`follow:${followerId}`, 30, 60_000);
  const target = await sql.query<{ user_id: string }>(
    "select user_id from profiles where user_id=$1 and deletion_requested_at is null and banned_at is null limit 1",
    [sellerId],
  );
  if (!target[0]) throw new Error("Satıcı bulunamadı.");
  const blocked = await sql.query<{ blocker_id: string }>(
    "select blocker_id from user_blocks where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1) limit 1",
    [followerId, sellerId],
  );
  if (blocked[0]) throw new Error("Bu kullanıcı takip edilemiyor.");
  await ensureProfile(followerId);
  await sql.query(
    "insert into seller_follows (follower_id, seller_id) values ($1, $2) on conflict (follower_id, seller_id) do nothing",
    [followerId, sellerId],
  );
  const count = await sql.query<{ n: number }>(
    "select count(*)::int as n from seller_follows where seller_id=$1",
    [sellerId],
  );
  return { following: true, followers: num(count[0]?.n) };
}

/** Stop following a seller and return the updated follower count. */
export async function unfollowSellerRecord(
  sql: QuerySql,
  followerId: string,
  sellerId: string,
): Promise<{ following: boolean; followers: number }> {
  rateLimit(`follow:${followerId}`, 30, 60_000);
  await sql.query("delete from seller_follows where follower_id=$1 and seller_id=$2", [followerId, sellerId]);
  const count = await sql.query<{ n: number }>(
    "select count(*)::int as n from seller_follows where seller_id=$1",
    [sellerId],
  );
  return { following: false, followers: num(count[0]?.n) };
}

/** Whether `viewerId` follows `sellerId` plus total follower count. */
export async function getFollowStatusRecord(
  sql: QuerySql,
  viewerId: string | null,
  sellerId: string,
): Promise<{ following: boolean; followers: number }> {
  const rows = await sql.query<{ followers: number; following: boolean }>(
    `select count(*)::int as followers,
            coalesce(bool_or(follower_id = $2), false) as following
     from seller_follows
     where seller_id = $1`,
    [sellerId, viewerId ?? ""],
  );
  return {
    following: Boolean(viewerId && rows[0]?.following),
    followers: num(rows[0]?.followers),
  };
}

/** Active sellers followed by `followerId`, newest follow first. */
export async function myFollowedSellersRecord(
  sql: QuerySql,
  followerId: string,
): Promise<FollowedSellerSummary[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `select sf.seller_id, sf.created_at as followed_at,
            p.display_name, p.avatar_url, p.city,
            s.name as store_name, s.slug as store_slug,
            (select count(*)::int from listings l
             where l.user_id = sf.seller_id and l.status = 'ACTIVE'
               and (l.expires_at is null or l.expires_at > now())) as active_count
     from seller_follows sf
     join profiles p on p.user_id = sf.seller_id
     left join stores s on s.user_id = sf.seller_id
     where sf.follower_id = $1
       and p.deletion_requested_at is null
       and p.banned_at is null
     order by sf.created_at desc
     limit 200`,
    [followerId],
  );
  return rows.map((r) => ({
    id: String(r.seller_id),
    name: String(r.display_name ?? "Satıcı"),
    avatar: r.avatar_url ? String(r.avatar_url) : null,
    city: r.city ? String(r.city) : null,
    store_name: r.store_name ? String(r.store_name) : null,
    store_slug: r.store_slug ? String(r.store_slug) : null,
    active_count: num(r.active_count),
    followed_at: asIso(r.followed_at),
  }));
}

/** Notify followers when a seller publishes a live ACTIVE listing. */
export async function notifySellerFollowers(
  sql: QuerySql,
  listing: { id: string; title: string; slug: string; userId: string; sellerName: string },
): Promise<number> {
  const followers = await sql.query<{ follower_id: string }>(
    `select sf.follower_id
     from seller_follows sf
     join profiles p on p.user_id = sf.follower_id
     where sf.seller_id = $1
       and sf.follower_id <> $1
       and p.deletion_requested_at is null
       and p.banned_at is null
       and not exists (
         select 1 from user_blocks b
         where (b.blocker_id = $1 and b.blocked_id = sf.follower_id)
            or (b.blocker_id = sf.follower_id and b.blocked_id = $1)
       )
     order by sf.created_at desc
     limit 500`,
    [listing.userId],
  );
  if (!followers.length) return 0;
  await Promise.allSettled(
    followers.map(({ follower_id }) =>
      notify(
        follower_id,
        "listing",
        `${listing.sellerName} yeni ilan yayınladı`,
        listing.title,
        `/ilan/${listing.slug}`,
      ),
    ),
  );
  return followers.length;
}

const SellerIdInput = z.object({ sellerId: z.string().trim().min(1).max(120) });

export const followSeller = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(SellerIdInput)
  .handler(async ({ context, data }) => followSellerRecord(await getSql(), context.userId, data.sellerId));

export const unfollowSeller = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(SellerIdInput)
  .handler(async ({ context, data }) => unfollowSellerRecord(await getSql(), context.userId, data.sellerId));

export const getFollowStatus = createServerFn({ method: "POST" })
  .validator(SellerIdInput)
  .handler(async ({ data }) => {
    const user = await getSessionUser().catch(() => null);
    return getFollowStatusRecord(await getSql(), user?.id ?? null, data.sellerId);
  });

export const myFollowedSellers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => myFollowedSellersRecord(await getSql(), context.userId));
