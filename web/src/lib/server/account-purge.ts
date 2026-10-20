import type { Sql } from "@/lib/db";

/** Days a chat stays stored (unseen) once it is gone on both sides. */
export const CHAT_RETENTION_DAYS = 60;
/** Days a deleted account can still be restored by signing in. */
export const ACCOUNT_GRACE_DAYS = 30;

/**
 * Delete what GeldeSat stores for a user, in one transaction so a failure
 * part-way never leaves a half-deleted account. Chats stay with the other
 * party (see below) and reviews the user wrote stay, attributed to
 * "Silinmiş kullanıcı". `includeAuth` also removes the Better Auth rows
 * (user, sessions, sign-in methods).
 */
export async function purgeUserData(
  sql: Sql,
  userId: string,
  { deleteListings = true, includeAuth = true }: { deleteListings?: boolean; includeAuth?: boolean } = {},
): Promise<void> {
  await sql.transaction(async (tx) => {
    await tx.query("delete from notifications where user_id=$1", [userId]);
    await tx.query("delete from mobile_push_tokens where user_id=$1", [userId]);
    await tx.query("delete from credit_ledger where user_id=$1", [userId]);
    await tx.query("delete from credit_orders where user_id=$1", [userId]);
    await tx.query("delete from boosts where user_id=$1", [userId]);
    await tx.query("delete from phone_reveals where viewer_id=$1", [userId]);
    await tx.query("delete from favorites where user_id=$1", [userId]);
    await tx.query("delete from listing_views where user_id=$1", [userId]);
    // Reviews about this user go; reviews they wrote stay and show "Silinmiş kullanıcı".
    await tx.query("delete from reviews where seller_id=$1", [userId]);
    await tx.query("delete from reports where reporter_id=$1", [userId]);
    await tx.query("delete from user_blocks where blocker_id=$1 or blocked_id=$1", [userId]);
    // Chats are not deleted: they stay with the other person ("Silinmiş kullanıcı").
    // This side is closed; a chat now gone on both sides is purged after the retention period.
    await tx.query("update conversations set buyer_hidden_at = coalesce(buyer_hidden_at, now()) where buyer_id=$1", [userId]);
    await tx.query("update conversations set seller_hidden_at = coalesce(seller_hidden_at, now()) where seller_id=$1", [userId]);
    await tx.query(
      `update conversations set purge_after = now() + make_interval(days => $2)
       where (buyer_id=$1 or seller_id=$1) and buyer_hidden_at is not null and seller_hidden_at is not null and purge_after is null`,
      [userId, CHAT_RETENTION_DAYS],
    );

    if (deleteListings) {
      await tx.query("delete from listings where user_id=$1", [userId]);
      await tx.query("delete from mobile_listing_images where user_id=$1", [userId]);
    } else {
      // Kept listings still reference the user's photos, so those stay.
      await tx.query("update listings set status='INACTIVE' where user_id=$1", [userId]);
      await tx.query(
        `delete from mobile_listing_images i where i.user_id=$1 and not exists (
           select 1 from listings l where l.user_id=$1 and (
             l.images @> jsonb_build_array('/api/mobile/images/' || i.id) or
             l.images @> jsonb_build_array('/uploads/' || i.storage_key)))`,
        [userId],
      );
    }

    await tx.query("delete from user_avatars where user_id=$1", [userId]);
    await tx.query("delete from stores where user_id=$1", [userId]);
    await tx.query("delete from profiles where user_id=$1", [userId]);
    if (includeAuth) {
      await tx.query('delete from "session" where "userId"=$1', [userId]);
      await tx.query('delete from "account" where "userId"=$1', [userId]);
      await tx.query('delete from "user" where id=$1', [userId]);
    }
  });
}
