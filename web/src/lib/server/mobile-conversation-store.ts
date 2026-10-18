import { hasUserBlock } from "./user-blocks.ts";

type ConversationSql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export async function createOrGetConversation(
  sql: ConversationSql,
  listingId: string,
  buyerId: string,
  sellerId: string,
  provisionalId: string,
): Promise<string> {
  await sql.query(
    `insert into conversations (id,listing_id,buyer_id,seller_id) values ($1,$2,$3,$4)
     on conflict (listing_id,buyer_id) do update set updated_at=now()`,
    [provisionalId, listingId, buyerId, sellerId],
  );
  const rows = await sql.query<{ id: string }>(
    "select id from conversations where listing_id=$1 and buyer_id=$2",
    [listingId, buyerId],
  );
  return rows[0]?.id ?? provisionalId;
}

export async function insertConversationMessage(
  sql: ConversationSql,
  id: string,
  conversationId: string,
  senderId: string,
  content: string,
): Promise<Record<string, unknown>> {
  const rows = await sql.query<Record<string, unknown>>(
    "insert into messages (id,conversation_id,sender_id,content) values ($1,$2,$3,$4) returning id,sender_id,content,created_at,read_at",
    [id, conversationId, senderId, content],
  );
  // A new message brings a deleted chat back to both inboxes.
  await sql.query(
    "update conversations set updated_at=now(), buyer_hidden_at=null, seller_hidden_at=null, purge_after=null where id=$1",
    [conversationId],
  );
  return rows[0];
}

export async function loadConversationThread(
  sql: ConversationSql,
  conversationId: string,
  userId: string,
) {
  const rows = await sql.query<Record<string, unknown>>(
    `select cv.*, l.title as listing_title, l.images, l.price,
            case when cv.buyer_id=$2 then sp.display_name else bp.display_name end as other_name,
            case when cv.buyer_id=$2 then cv.seller_id else cv.buyer_id end as other_id
     from conversations cv left join listings l on l.id=cv.listing_id
     left join profiles bp on bp.user_id=cv.buyer_id left join profiles sp on sp.user_id=cv.seller_id
     where cv.id=$1 and (cv.buyer_id=$2 or cv.seller_id=$2) limit 1`,
    [conversationId, userId],
  );
  const conversation = rows[0];
  if (!conversation) return null;

  const otherUserId = String(conversation.buyer_id === userId ? conversation.seller_id : conversation.buyer_id);
  const [blockedByMe, blockedByOther] = await Promise.all([
    hasUserBlock(sql, userId, otherUserId),
    hasUserBlock(sql, otherUserId, userId),
  ]);
  const unread = await sql.query<{ id: string }>(
    "select id from messages where conversation_id=$1 and sender_id<>$2 and read_at is null",
    [conversationId, userId],
  );
  if (unread.length) {
    await sql.query(
      "update messages set read_at=now() where conversation_id=$1 and sender_id<>$2 and read_at is null",
      [conversationId, userId],
    );
  }
  const messages = await sql.query<Record<string, unknown>>(
    `select * from (select id,sender_id,content,created_at,read_at from messages where conversation_id=$1 order by created_at desc limit 200) recent order by created_at asc`,
    [conversationId],
  );
  return { conversation, otherUserId, blockedByMe, blockedByOther, unread, messages };
}
