import { getSql, type Sql } from "@/lib/db";
import { ACCOUNT_GRACE_DAYS, CHAT_RETENTION_DAYS, purgeUserData } from "./account-purge";

/** Shown in chats and reviews in place of a purged account. */
export const DELETED_USER_NAME = "Silinmiş kullanıcı";

/** SQL condition: the chat `cv` is still in the inbox of the user bound to `param`. */
export function chatVisibleTo(param: string): string {
  return `(case when cv.buyer_id = ${param} then cv.buyer_hidden_at else cv.seller_hidden_at end) is null`;
}

/**
 * Remove a chat from one user's inbox. The other person keeps it; once it is
 * gone on both sides it is kept unseen for the retention period, then purged.
 */
export async function hideConversationFor(sql: Sql, conversationId: string, userId: string): Promise<boolean> {
  const rows = await sql.query<{ id: string }>(
    `update conversations set
       buyer_hidden_at = case when buyer_id = $2 then coalesce(buyer_hidden_at, now()) else buyer_hidden_at end,
       seller_hidden_at = case when seller_id = $2 then coalesce(seller_hidden_at, now()) else seller_hidden_at end
     where id = $1 and (buyer_id = $2 or seller_id = $2)
     returning id`,
    [conversationId, userId],
  );
  if (!rows[0]) return false;
  await sql.query(
    `update conversations set purge_after = now() + make_interval(days => $2)
     where id = $1 and buyer_hidden_at is not null and seller_hidden_at is not null and purge_after is null`,
    [conversationId, CHAT_RETENTION_DAYS],
  );
  return true;
}

/** A new message brings a deleted chat back for both people (like WhatsApp). */
export async function reopenConversation(sql: Sql, conversationId: string): Promise<void> {
  await sql.query(
    "update conversations set buyer_hidden_at = null, seller_hidden_at = null, purge_after = null where id = $1",
    [conversationId],
  );
}

/** True when the user's account is gone, waiting for deletion or suspended: nobody can start or continue chats with them. */
export async function isClosedAccount(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql.query<{ pending: boolean }>(
    "select (deletion_requested_at is not null or banned_at is not null) as pending from profiles where user_id = $1",
    [userId],
  );
  return !rows[0] || rows[0].pending;
}

/**
 * Start the deletion grace period: hide the user's listings (remembering their
 * status) and end every session. Data stays until the sweep purges it.
 */
export async function requestAccountDeletion(userId: string): Promise<string> {
  const sql = await getSql();
  const until = await sql.transaction(async (tx) => {
    const rows = await tx.query<{ until: string }>(
      `update profiles set deletion_requested_at = coalesce(deletion_requested_at, now())
       where user_id = $1
       returning (deletion_requested_at + make_interval(days => $2))::text as until`,
      [userId, ACCOUNT_GRACE_DAYS],
    );
    await tx.query(
      `update listings set status_before_deletion = status, status = 'INACTIVE', updated_at = now()
       where user_id = $1 and status_before_deletion is null`,
      [userId],
    );
    await tx.query('delete from "session" where "userId" = $1', [userId]);
    return rows[0]?.until ?? "";
  });
  return until;
}

/** Undo a deletion request within the grace period. */
export async function restoreAccount(userId: string): Promise<void> {
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    await tx.query("update profiles set deletion_requested_at = null where user_id = $1", [userId]);
    await tx.query(
      `update listings set status = status_before_deletion, status_before_deletion = null, updated_at = now()
       where user_id = $1 and status_before_deletion is not null`,
      [userId],
    );
  });
}

let lastSweep = 0;

/**
 * Purge accounts whose grace period ended and chats whose retention ended.
 * Runs at most hourly, piggybacking on regular traffic like the expiry sweep.
 */
export async function sweepRetention(force = false): Promise<void> {
  if (!force && Date.now() - lastSweep < 60 * 60_000) return;
  lastSweep = Date.now();
  const sql = await getSql();
  const due = await sql.query<{ user_id: string }>(
    `select user_id from profiles
     where deletion_requested_at is not null and deletion_requested_at < now() - make_interval(days => $1)
     limit 50`,
    [ACCOUNT_GRACE_DAYS],
  );
  for (const { user_id } of due) {
    try {
      await purgeUserData(sql, user_id);
    } catch (err) {
      console.error("[retention] account purge failed", user_id, err);
    }
  }
  await sql.query("delete from conversations where purge_after is not null and purge_after < now()");
}
