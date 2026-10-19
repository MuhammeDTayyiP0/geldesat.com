import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { asIso, asJson, formatPrice, newId, num } from "@/lib/utils";
import { DELETE_WINDOW_MS, DELETED_MESSAGE_TEXT, MAX_TEMPLATE_LENGTH, MAX_TEMPLATES, type ChatMessage, type OfferStatus } from "@/lib/chat-shared";
import { ensureProfile, firstInWindow, notify, rateLimit } from "./helpers";
import { chatVisibleTo, DELETED_USER_NAME, hideConversationFor, isClosedAccount, reopenConversation } from "./retention";
import {
  broadcastChatMessage,
  broadcastChatRead,
  broadcastChatUpdate,
  broadcastTyping,
  broadcastUserInbox,
  isOnline,
  isViewingConversation,
} from "./chat-bus";

/** Messages per page when opening a chat or scrolling back. */
const THREAD_PAGE = 60;
/** Message columns, plus the quoted message (if replying) as JSON; valid in SELECT and RETURNING. */
const MSG_COLUMNS = `id, sender_id, content, kind, meta, deleted_at, created_at, read_at, reply_to,
  (select json_build_object('id', r.id, 'sender_id', r.sender_id, 'kind', r.kind,
          'content', case when r.deleted_at is null then r.content else '${DELETED_MESSAGE_TEXT}' end)
   from messages r where r.id = messages.reply_to) as reply`;

type Conv = { id: string; buyer_id: string; seller_id: string; listing_id: string | null };

export function mapMsg(m: Record<string, unknown>, hideRead = false): ChatMessage {
  const deleted = m.deleted_at != null;
  return {
    id: String(m.id),
    sender_id: String(m.sender_id),
    content: deleted ? DELETED_MESSAGE_TEXT : String(m.content),
    kind: deleted ? "text" : ((String(m.kind ?? "text") as ChatMessage["kind"]) ?? "text"),
    meta: deleted ? null : (asJson<ChatMessage["meta"]>(m.meta, null) ?? null),
    deleted,
    created_at: asIso(m.created_at),
    read_at: !hideRead && m.read_at ? asIso(m.read_at) : null,
    reply: deleted ? null : asJson<ChatMessage["reply"]>(m.reply, null),
  };
}

async function blockedBetween(sql: Sql, a: string, b: string) {
  const rows = await sql.query<{ n: number }>(
    `select 1 as n from user_blocks
     where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1)
     limit 1`,
    [a, b],
  );
  return Boolean(rows[0]);
}

/** The conversation, if the user is one of its two people; throws otherwise. */
async function myConversation(sql: Sql, conversationId: string, userId: string): Promise<Conv> {
  const rows = await sql.query<Conv>("select id, buyer_id, seller_id, listing_id from conversations where id=$1", [conversationId]);
  const conv = rows[0];
  if (!conv || (conv.buyer_id !== userId && conv.seller_id !== userId)) throw new Error("Konuşma bulunamadı");
  return conv;
}

const otherOf = (conv: Conv, userId: string) => (conv.buyer_id === userId ? conv.seller_id : conv.buyer_id);
const sideOf = (conv: Conv, userId: string) => (conv.buyer_id === userId ? "buyer" : "seller");

async function assertCanMessage(sql: Sql, from: string, to: string) {
  if (await blockedBetween(sql, from, to)) throw new Error("Bu kullanıcıyla mesajlaşamazsınız.");
  if (await isClosedAccount(sql, to)) throw new Error("Bu kullanıcı hesabını kapattı. Mesaj gönderilemez.");
}

/** Whether `viewer` may see when `other` read messages (other's privacy switch). */
async function readsVisible(sql: Sql, other: string): Promise<boolean> {
  const rows = await sql.query<{ read_receipts: boolean }>("select read_receipts from profiles where user_id=$1", [other]);
  return rows[0]?.read_receipts ?? true;
}

/**
 * Store a message, reopen the chat for both sides, push it live and notify the
 * receiver unless they have the chat open or were notified about it recently.
 */
async function deliver(
  sql: Sql,
  conv: Conv,
  senderId: string,
  message: { content: string; kind?: ChatMessage["kind"]; meta?: ChatMessage["meta"]; replyTo?: string },
): Promise<ChatMessage> {
  const id = newId("msg");
  // A reply may only quote a message from the same chat.
  const replyTo = message.replyTo
    ? ((await sql.query<{ id: string }>("select id from messages where id=$1 and conversation_id=$2", [message.replyTo, conv.id]))[0]?.id ?? null)
    : null;
  const rows = await sql.query<Record<string, unknown>>(
    `insert into messages (id, conversation_id, sender_id, content, kind, meta, reply_to)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7) returning ${MSG_COLUMNS}`,
    [id, conv.id, senderId, message.content, message.kind ?? "text", message.meta ? JSON.stringify(message.meta) : null, replyTo],
  );
  await sql.query("update conversations set updated_at=now() where id=$1", [conv.id]);
  await reopenConversation(sql, conv.id);
  const msg = mapMsg(rows[0]);
  const receiver = otherOf(conv, senderId);
  broadcastChatMessage(conv.id, msg);
  broadcastUserInbox(receiver, { type: "new_message", conversationId: conv.id, message: msg });
  broadcastUserInbox(senderId, { type: "inbox_ping", conversationId: conv.id });
  if (!isViewingConversation(receiver, conv.id) && firstInWindow(`msgnotify:${receiver}:${conv.id}`, 2 * 60_000)) {
    await notify(receiver, "message", "Yeni mesaj", message.content.slice(0, 80), `/mesajlar/${conv.id}`);
  }
  return msg;
}

export const startConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ listingId: z.string(), content: z.string().trim().min(1, "Mesaj boş olamaz").max(2000) }))
  .handler(async ({ context, data }) => {
    rateLimit(`msg:${context.userId}`, 40, 60_000);
    const sql = await getSql();
    await ensureProfile(context.userId);
    const listing = await sql.query<{ id: string; user_id: string; status: string }>(
      "select id, user_id, status from listings where id=$1 and (expires_at is null or expires_at > now())",
      [data.listingId],
    );
    if (!listing[0] || listing[0].status !== "ACTIVE") throw new Error("İlan bulunamadı");
    if (listing[0].user_id === context.userId) throw new Error("Kendi ilanınıza mesaj gönderemezsiniz.");
    await assertCanMessage(sql, context.userId, listing[0].user_id);
    await sql.query(
      `insert into conversations (id, listing_id, buyer_id, seller_id) values ($1,$2,$3,$4)
       on conflict (listing_id, buyer_id) do update set updated_at = now()`,
      [newId("cnv"), data.listingId, context.userId, listing[0].user_id],
    );
    const conv = (await sql.query<Conv>(
      "select id, buyer_id, seller_id, listing_id from conversations where listing_id=$1 and buyer_id=$2",
      [data.listingId, context.userId],
    ))[0];
    await deliver(sql, conv, context.userId, { content: data.content.trim() });
    return { conversationId: conv.id };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      conversationId: z.string(),
      content: z.string().trim().min(1, "Mesaj boş olamaz").max(2000),
      replyTo: z.string().max(60).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    rateLimit(`msg:${context.userId}`, 40, 60_000);
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    await assertCanMessage(sql, context.userId, otherOf(conv, context.userId));
    return deliver(sql, conv, context.userId, { content: data.content.trim(), replyTo: data.replyTo });
  });

/** Share a meeting point: coordinates from the browser and/or a typed place name. */
export const sendLocation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      conversationId: z.string(),
      label: z.string().trim().min(2, "Bir yer adı yazın").max(120),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    rateLimit(`msg:${context.userId}`, 40, 60_000);
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    await assertCanMessage(sql, context.userId, otherOf(conv, context.userId));
    // ~11 m precision is plenty for a meeting point and avoids over-sharing.
    const round = (n?: number) => (n == null ? undefined : Math.round(n * 10_000) / 10_000);
    return deliver(sql, conv, context.userId, {
      content: `📍 Konum: ${data.label}`,
      kind: "location",
      meta: { label: data.label, lat: round(data.lat), lng: round(data.lng) },
    });
  });

/**
 * A price offer card. The buyer opens with an offer; either side may answer the
 * other's pending offer with a counter offer (`counterTo`). One offer is open
 * at a time: a new one withdraws (or, for the answered one, counters) the rest.
 */
export const sendOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      conversationId: z.string(),
      amount: z.number().int().min(1).max(1_000_000_000),
      counterTo: z.string().max(60).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    rateLimit(`offer:${context.userId}`, 10, 60_000);
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    const listing = conv.listing_id
      ? (await sql.query<{ status: string }>("select status from listings where id=$1", [conv.listing_id]))[0]
      : undefined;
    if (!listing || listing.status !== "ACTIVE") throw new Error("İlan yayında değil; teklif verilemez.");
    await assertCanMessage(sql, context.userId, otherOf(conv, context.userId));
    if (data.counterTo) {
      const target = await sql.query<{ sender_id: string; meta: unknown }>(
        "select sender_id, meta from messages where id=$1 and conversation_id=$2 and kind='offer' and deleted_at is null",
        [data.counterTo, conv.id],
      );
      if (!target[0] || target[0].sender_id === context.userId || asJson<{ status?: string }>(target[0].meta, {}).status !== "pending") {
        throw new Error("Bu teklif artık geçerli değil.");
      }
    } else if (conv.buyer_id !== context.userId) {
      throw new Error("Satıcı yalnızca gelen bir teklife karşı teklif verebilir.");
    }
    const closed = await sql.query<Record<string, unknown>>(
      `update messages set meta = jsonb_set(meta, '{status}', to_jsonb(case when id = $2 then 'countered' else 'withdrawn' end))
       where conversation_id=$1 and kind='offer' and deleted_at is null and meta->>'status'='pending'
       returning ${MSG_COLUMNS}`,
      [conv.id, data.counterTo ?? ""],
    );
    for (const m of closed) broadcastChatUpdate(conv.id, mapMsg(m));
    return deliver(sql, conv, context.userId, {
      content: `${data.counterTo ? "Karşı teklif" : "Teklif"}: ${formatPrice(data.amount)}`,
      kind: "offer",
      meta: { amount: data.amount, status: "pending", counter: Boolean(data.counterTo) },
    });
  });

/** The person who received a pending offer accepts or declines it. */
export const respondOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ messageId: z.string(), accept: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ conversation_id: string; sender_id: string; meta: unknown }>(
      "select conversation_id, sender_id, meta from messages where id=$1 and kind='offer' and deleted_at is null",
      [data.messageId],
    );
    if (!rows[0]) throw new Error("Teklif bulunamadı");
    const conv = await myConversation(sql, rows[0].conversation_id, context.userId);
    if (rows[0].sender_id === context.userId) throw new Error("Kendi teklifinize yanıt veremezsiniz.");
    const offerer = rows[0].sender_id;
    const meta = asJson<{ amount?: number; status?: OfferStatus }>(rows[0].meta, {});
    if (meta.status !== "pending") throw new Error("Bu teklif artık geçerli değil.");
    const status: OfferStatus = data.accept ? "accepted" : "rejected";
    const updated = await sql.query<Record<string, unknown>>(
      `update messages set meta = jsonb_set(meta, '{status}', to_jsonb($2::text)) where id=$1 returning ${MSG_COLUMNS}`,
      [data.messageId, status],
    );
    const msg = mapMsg(updated[0]);
    broadcastChatUpdate(conv.id, msg);
    broadcastUserInbox(offerer, { type: "inbox_ping", conversationId: conv.id });
    await notify(
      offerer,
      "message",
      data.accept ? "Teklifiniz kabul edildi" : "Teklifiniz reddedildi",
      `${formatPrice(meta.amount ?? 0)} teklifiniz ${data.accept ? "kabul edildi. Buluşmayı mesajlaşarak ayarlayabilirsiniz." : "reddedildi."}`,
      `/mesajlar/${conv.id}`,
    );
    return msg;
  });

/** Delete my own message for everyone, within an hour of sending. */
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ messageId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ conversation_id: string; sender_id: string; created_at: string; kind: string; meta: unknown }>(
      "select conversation_id, sender_id, created_at, kind, meta from messages where id=$1 and deleted_at is null",
      [data.messageId],
    );
    const m = rows[0];
    if (!m || m.sender_id !== context.userId) throw new Error("Mesaj bulunamadı");
    if (Date.now() - new Date(m.created_at).getTime() > DELETE_WINDOW_MS) throw new Error("Mesajlar yalnızca gönderildikten sonraki 1 saat içinde silinebilir.");
    if (m.kind === "image") {
      const imageId = asJson<{ image_id?: string }>(m.meta, {}).image_id;
      if (imageId) await sql.query("delete from chat_images where id=$1", [imageId]);
    }
    const updated = await sql.query<Record<string, unknown>>(
      `update messages set deleted_at=now(), content=$2, meta=null where id=$1 returning ${MSG_COLUMNS}`,
      [data.messageId, DELETED_MESSAGE_TEXT],
    );
    const msg = mapMsg(updated[0]);
    broadcastChatUpdate(m.conversation_id, msg);
    return msg;
  });

/** Inbox: my visible chats with the other person, listing, last message and unread count. */
export const listConversations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select cv.id, cv.listing_id, cv.buyer_id, cv.seller_id, cv.updated_at,
              l.title as listing_title, l.slug as listing_slug, l.images, l.price, l.status as listing_status,
              op.display_name as other_name, op.avatar_url as other_avatar, op.deletion_requested_at as other_closing,
              case when cv.buyer_id = $1 then cv.seller_id else cv.buyer_id end as other_id,
              case when cv.buyer_id = $1 then cv.buyer_archived_at else cv.seller_archived_at end as archived_at,
              case when cv.buyer_id = $1 then cv.buyer_marked_unread else cv.seller_marked_unread end as marked_unread,
              lm.content as last_content, lm.kind as last_kind, lm.sender_id as last_sender_id, lm.deleted_at as last_deleted,
              coalesce(u.n, 0) as unread
       from conversations cv
       left join listings l on l.id = cv.listing_id
       left join profiles op on op.user_id = case when cv.buyer_id = $1 then cv.seller_id else cv.buyer_id end
       left join lateral (
         select content, kind, sender_id, deleted_at from messages m
         where m.conversation_id = cv.id order by m.created_at desc limit 1
       ) lm on true
       left join lateral (
         select count(*)::int as n from messages m
         where m.conversation_id = cv.id and m.sender_id <> $1 and m.read_at is null
       ) u on true
       where (cv.buyer_id = $1 or cv.seller_id = $1) and ${chatVisibleTo("$1")}
       order by cv.updated_at desc
       limit 300`,
      [context.userId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      role: (String(r.buyer_id) === context.userId ? "buying" : "selling") as "buying" | "selling",
      listing_id: r.listing_id ? String(r.listing_id) : "",
      listing_title: r.listing_title ? String(r.listing_title) : "İlan kaldırıldı",
      listing_slug: r.listing_slug ? String(r.listing_slug) : "",
      listing_image: r.images ? (asJson<string[]>(r.images, [])[0] ?? null) : null,
      listing_status: r.listing_status ? String(r.listing_status) : "REMOVED",
      price: r.price ? num(r.price) : 0,
      other_id: String(r.other_id),
      other_name: r.other_name == null ? DELETED_USER_NAME : String(r.other_name),
      other_avatar: r.other_avatar ? String(r.other_avatar) : null,
      other_closed: r.other_name == null || r.other_closing != null,
      other_online: r.other_name != null && isOnline(String(r.other_id)),
      archived: r.archived_at != null,
      marked_unread: Boolean(r.marked_unread),
      last_content: r.last_content == null ? "" : String(r.last_content),
      last_kind: String(r.last_kind ?? "text"),
      last_deleted: r.last_deleted != null,
      last_sender_id: r.last_sender_id ? String(r.last_sender_id) : "",
      unread: num(r.unread),
      updated_at: asIso(r.updated_at),
    }));
  });

/** Open a chat: header data and the newest page of messages. Reading is marked separately. */
export const getThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    const otherId = otherOf(conv, context.userId);
    const head = await sql.query<Record<string, unknown>>(
      `select l.title, l.slug, l.images, l.price, l.status as listing_status,
              op.display_name as other_name, op.avatar_url as other_avatar, op.last_seen_at as other_last_seen,
              op.deletion_requested_at as other_closing, coalesce(op.read_receipts, true) as other_receipts,
              coalesce(mp.read_receipts, true) as my_receipts
       from conversations cv
       left join listings l on l.id = cv.listing_id
       left join profiles op on op.user_id = $2
       left join profiles mp on mp.user_id = $3
       where cv.id = $1`,
      [conv.id, otherId, context.userId],
    );
    const h = head[0] ?? {};
    const [blockedByMeRows, blockedByOtherRows] = await Promise.all([
      sql.query("select 1 from user_blocks where blocker_id=$1 and blocked_id=$2 limit 1", [context.userId, otherId]),
      sql.query("select 1 from user_blocks where blocker_id=$1 and blocked_id=$2 limit 1", [otherId, context.userId]),
    ]);
    // Receipts are mutual, like WhatsApp: hidden if either side turned them off.
    const showReads = Boolean(h.other_receipts) && Boolean(h.my_receipts);
    const page = await sql.query<Record<string, unknown>>(
      `select ${MSG_COLUMNS} from messages where conversation_id=$1 order by created_at desc limit $2`,
      [conv.id, THREAD_PAGE + 1],
    );
    const hasMore = page.length > THREAD_PAGE;
    const messages = page.slice(0, THREAD_PAGE).reverse().map((m) => mapMsg(m, !showReads && String(m.sender_id) === context.userId));
    const firstUnread = messages.find((m) => m.sender_id !== context.userId && !m.read_at && !m.deleted);
    return {
      conversation: {
        id: conv.id,
        role: sideOf(conv, context.userId) === "buyer" ? ("buying" as const) : ("selling" as const),
        listing_id: conv.listing_id ?? "",
        listing_title: h.title ? String(h.title) : "İlan kaldırıldı",
        listing_slug: h.slug ? String(h.slug) : "",
        listing_image: h.images ? (asJson<string[]>(h.images, [])[0] ?? null) : null,
        listing_price: h.price ? num(h.price) : null,
        listing_status: h.listing_status ? String(h.listing_status) : "REMOVED",
        other_id: otherId,
        other_name: h.other_name == null ? DELETED_USER_NAME : String(h.other_name),
        other_closed: h.other_name == null || h.other_closing != null,
        other_avatar: h.other_avatar ? String(h.other_avatar) : null,
        other_online: h.other_name != null && isOnline(otherId),
        other_last_seen: h.other_last_seen ? asIso(h.other_last_seen) : null,
        buyer_id: conv.buyer_id,
        seller_id: conv.seller_id,
      },
      messages,
      hasMore,
      firstUnreadId: firstUnread?.id ?? null,
      showReads,
      blockedByMe: Boolean(blockedByMeRows[0]),
      blockedByOther: Boolean(blockedByOtherRows[0]),
    };
  });

/** Older messages before `before` (an ISO time), for scrolling back. */
export const loadOlderMessages = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), before: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    const showReads = (await readsVisible(sql, otherOf(conv, context.userId))) && (await readsVisible(sql, context.userId));
    const page = await sql.query<Record<string, unknown>>(
      `select ${MSG_COLUMNS} from messages where conversation_id=$1 and created_at < $2::timestamptz
       order by created_at desc limit $3`,
      [conv.id, data.before, THREAD_PAGE + 1],
    );
    return {
      messages: page.slice(0, THREAD_PAGE).reverse().map((m) => mapMsg(m, !showReads && String(m.sender_id) === context.userId)),
      hasMore: page.length > THREAD_PAGE,
    };
  });

/**
 * Fallback for missed live events: messages after `after`, changed messages
 * and fresh read receipts. Also refreshes the other person's presence.
 */
export const pollThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), after: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    const otherId = otherOf(conv, context.userId);
    const showReads = (await readsVisible(sql, otherId)) && (await readsVisible(sql, context.userId));
    const after = new Date(data.after);
    const afterIso = Number.isNaN(after.getTime()) ? new Date(Date.now() - 60_000).toISOString() : after.toISOString();
    const fresh = await sql.query<Record<string, unknown>>(
      `select ${MSG_COLUMNS} from messages where conversation_id=$1 and created_at > $2::timestamptz order by created_at asc limit 100`,
      [conv.id, afterIso],
    );
    const reads = showReads
      ? await sql.query<{ id: string; read_at: string }>(
          "select id, read_at from messages where conversation_id=$1 and sender_id=$2 and read_at > $3::timestamptz - interval '60 seconds'",
          [conv.id, context.userId, afterIso],
        )
      : [];
    const lastSeen = await sql.query<{ last_seen_at: string | null }>("select last_seen_at from profiles where user_id=$1", [otherId]);
    return {
      messages: fresh.map((m) => mapMsg(m, !showReads && String(m.sender_id) === context.userId)),
      reads: reads.map((r) => ({ id: String(r.id), read_at: asIso(r.read_at) })),
      other_online: isOnline(otherId),
      other_last_seen: lastSeen[0]?.last_seen_at ? asIso(lastSeen[0].last_seen_at) : null,
    };
  });

/** Mark messages I received as read (all, or the given ids) and clear "marked unread". */
export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), messageIds: z.array(z.string()).max(200).optional() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    const side = sideOf(conv, context.userId);
    await sql.query(`update conversations set ${side}_marked_unread=false where id=$1`, [conv.id]);
    const read = await sql.query<{ id: string }>(
      `update messages set read_at=now()
       where conversation_id=$1 and sender_id<>$2 and read_at is null ${data.messageIds?.length ? "and id = any($3)" : ""}
       returning id`,
      data.messageIds?.length ? [conv.id, context.userId, data.messageIds] : [conv.id, context.userId],
    );
    if (read.length) {
      const nowIso = new Date().toISOString();
      const showReads = (await readsVisible(sql, context.userId)) && (await readsVisible(sql, otherOf(conv, context.userId)));
      if (showReads) broadcastChatRead(conv.id, read.map((r) => ({ id: r.id, read_at: nowIso })));
    }
    broadcastUserInbox(context.userId, { type: "read_update", conversationId: conv.id });
    return { ok: true, readCount: read.length };
  });

/** "Yazıyor…" signal; the client sends it at most every few seconds while typing. */
export const sendTyping = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string() }))
  .handler(async ({ context, data }) => {
    if (!firstInWindow(`typing:${context.userId}:${data.conversationId}`, 2500)) return { ok: true };
    const sql = await getSql();
    await myConversation(sql, data.conversationId, context.userId);
    broadcastTyping(data.conversationId, context.userId);
    return { ok: true };
  });

export const archiveConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), archived: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    const side = sideOf(conv, context.userId);
    await sql.query(`update conversations set ${side}_archived_at = ${data.archived ? "now()" : "null"} where id=$1`, [conv.id]);
    broadcastUserInbox(context.userId, { type: "inbox_ping", conversationId: conv.id });
    return { ok: true };
  });

export const markConversationUnread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), unread: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    await sql.query(`update conversations set ${sideOf(conv, context.userId)}_marked_unread=$2 where id=$1`, [conv.id, data.unread]);
    broadcastUserInbox(context.userId, { type: "inbox_ping", conversationId: conv.id });
    return { ok: true };
  });

/** Delete a chat from my inbox only; the other person keeps it. */
export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string().max(100) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (!(await hideConversationFor(sql, data.conversationId, context.userId))) throw new Error("Konuşma bulunamadı");
    broadcastUserInbox(context.userId, { type: "inbox_ping", conversationId: data.conversationId });
    return { ok: true };
  });

/** Report a conversation (optionally one message) to moderators. */
export const reportConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      conversationId: z.string(),
      messageId: z.string().optional(),
      reason: z.string().min(3).max(80),
      details: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    rateLimit(`report:${context.userId}`, 10, 60_000);
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    const open = await sql.query("select 1 from reports where conversation_id=$1 and reporter_id=$2 and status='OPEN' limit 1", [
      conv.id,
      context.userId,
    ]);
    if (open[0]) return { ok: true };
    await sql.query(
      "insert into reports (id, listing_id, reporter_id, reason, details, conversation_id, message_id) values ($1,$2,$3,$4,$5,$6,$7)",
      [newId("rep"), conv.listing_id, context.userId, data.reason, data.details || null, conv.id, data.messageId || null],
    );
    return { ok: true };
  });

/** Count of unread messages across my visible, non-archived chats, plus chats I marked unread. */
export async function unreadMessageCount(sql: Sql, userId: string): Promise<number> {
  const rows = await sql.query<{ n: number }>(
    `select
       (select count(*)::int from messages m join conversations cv on cv.id = m.conversation_id
        where m.read_at is null and m.sender_id <> $1 and (cv.buyer_id=$1 or cv.seller_id=$1)
          and ${chatVisibleTo("$1")}
          and (case when cv.buyer_id=$1 then cv.buyer_archived_at else cv.seller_archived_at end) is null)
     + (select count(*)::int from conversations cv
        where ((cv.buyer_id=$1 and cv.buyer_marked_unread) or (cv.seller_id=$1 and cv.seller_marked_unread))
          and ${chatVisibleTo("$1")}) as n`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}

/** Users I blocked, for the settings page. */
export const listBlockedUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ blocked_id: string; created_at: string; display_name: string | null; avatar_url: string | null }>(
      `select b.blocked_id, b.created_at, p.display_name, p.avatar_url
       from user_blocks b left join profiles p on p.user_id = b.blocked_id
       where b.blocker_id=$1 order by b.created_at desc`,
      [context.userId],
    );
    return rows.map((r) => ({
      id: r.blocked_id,
      name: r.display_name ?? DELETED_USER_NAME,
      avatar: r.avatar_url,
      since: asIso(r.created_at),
    }));
  });

/** Store a processed chat photo and send it as a message (called by /api/chat/image). */
export async function sendChatPhoto(sql: Sql, userId: string, conversationId: string, imageId: string, data: Buffer): Promise<ChatMessage> {
  const conv = await myConversation(sql, conversationId, userId);
  await assertCanMessage(sql, userId, otherOf(conv, userId));
  await sql.query(
    "insert into chat_images (id, conversation_id, uploader_id, mime_type, data) values ($1,$2,$3,'image/webp',$4)",
    [imageId, conv.id, userId, data],
  );
  return deliver(sql, conv, userId, { content: "📷 Fotoğraf", kind: "image", meta: { image_id: imageId } });
}

/** Find messages in one chat containing `q` (newest first). */
export const searchMessages = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), q: z.string().trim().min(2).max(100) }))
  .handler(async ({ context, data }) => {
    rateLimit(`chatsearch:${context.userId}`, 30, 60_000);
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    // Escape LIKE wildcards so "%" and "_" in the query are literal.
    const like = `%${data.q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    const rows = await sql.query<{ id: string; sender_id: string; content: string; created_at: string }>(
      `select id, sender_id, content, created_at from messages
       where conversation_id=$1 and deleted_at is null and kind in ('text','offer','location') and content ilike $2
       order by created_at desc limit 50`,
      [conv.id, like],
    );
    return rows.map((r) => ({ id: r.id, sender_id: r.sender_id, content: r.content, created_at: asIso(r.created_at) }));
  });

/** A window of messages around one message, for jumping to a search result or quote. */
export const loadAroundMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), messageId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    const target = await sql.query<{ created_at: string }>("select created_at from messages where id=$1 and conversation_id=$2", [
      data.messageId,
      conv.id,
    ]);
    if (!target[0]) throw new Error("Mesaj bulunamadı");
    const showReads = (await readsVisible(sql, otherOf(conv, context.userId))) && (await readsVisible(sql, context.userId));
    const half = 30;
    const [before, after] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select ${MSG_COLUMNS} from messages where conversation_id=$1 and created_at < $2 order by created_at desc limit $3`,
        [conv.id, target[0].created_at, half + 1],
      ),
      sql.query<Record<string, unknown>>(
        `select ${MSG_COLUMNS} from messages where conversation_id=$1 and created_at >= $2 order by created_at asc limit $3`,
        [conv.id, target[0].created_at, half + 2],
      ),
    ]);
    const map = (m: Record<string, unknown>) => mapMsg(m, !showReads && String(m.sender_id) === context.userId);
    return {
      messages: [...before.slice(0, half).reverse(), ...after.slice(0, half + 1)].map(map),
      hasMoreBefore: before.length > half,
      hasMoreAfter: after.length > half + 1,
    };
  });

/** My saved reply templates. */
export const getChatTemplates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ chat_templates: unknown }>("select chat_templates from profiles where user_id=$1", [context.userId]);
    return asJson<string[]>(rows[0]?.chat_templates, []);
  });

export const saveChatTemplates = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ templates: z.array(z.string().trim().min(1).max(MAX_TEMPLATE_LENGTH)).max(MAX_TEMPLATES) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    await sql.query("update profiles set chat_templates=$2::jsonb where user_id=$1", [context.userId, JSON.stringify(data.templates)]);
    return data.templates;
  });
