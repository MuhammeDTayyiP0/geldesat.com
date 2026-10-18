import type { Sql } from "@/lib/db";

/**
 * Delete everything GeldeSat stores for a user, in one transaction so a failure
 * part-way never leaves a half-deleted account. `includeAuth` also removes the
 * Better Auth rows; leave it off when Better Auth deletes those itself (self
 * deletion via authClient.deleteUser).
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
    await tx.query("delete from reviews where seller_id=$1 or reviewer_id=$1", [userId]);
    await tx.query("delete from reports where reporter_id=$1", [userId]);
    await tx.query("delete from user_blocks where blocker_id=$1 or blocked_id=$1", [userId]);
    await tx.query(
      `delete from messages where sender_id=$1 or conversation_id in (
         select id from conversations where buyer_id=$1 or seller_id=$1
       )`,
      [userId],
    );
    await tx.query("delete from conversations where buyer_id=$1 or seller_id=$1", [userId]);

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
