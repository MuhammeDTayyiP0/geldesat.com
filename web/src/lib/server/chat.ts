import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { asIso, asJson, formatPrice, newId, num } from "@/lib/utils";
import { DELETE_WINDOW_MS, DELETED_MESSAGE_TEXT, EDIT_WINDOW_MS, MAX_TEMPLATE_LENGTH, MAX_TEMPLATES, type ChatMessage, type OfferStatus } from "@/lib/chat-shared";
import { resolveUserPrefs } from "@/lib/user-prefs";
import { ensureProfile, firstInWindow, notify, rateLimit, resetWindow } from "./helpers";
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
const MSG_COLUMNS = `id, sender_id, content, kind, meta, deleted_at, created_at, edited_at, read_at, reply_to, client_id,
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
    edited_at: !deleted && m.edited_at ? asIso(m.edited_at) : null,
    read_at: !hideRead && m.read_at ? asIso(m.read_at) : null,
    reply: deleted ? null : asJson<ChatMessage["reply"]>(m.reply, null),
    // Lets the sender's app swap its "sending…" bubble for this one, also when the live event arrives first.
    ...(m.client_id ? { client_id: String(m.client_id) } : {}),
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
export async function myConversation(sql: Sql, conversationId: string, userId: string): Promise<Conv> {
  const rows = await sql.query<Conv>("select id, buyer_id, seller_id, listing_id from conversations where id=$1", [conversationId]);
  const conv = rows[0];
  if (!conv || (conv.buyer_id !== userId && conv.seller_id !== userId)) throw new Error("Konuşma bulunamadı");
  return conv;
}

const otherOf = (conv: Conv, userId: string) => (conv.buyer_id === userId ? conv.seller_id : conv.buyer_id);
const sideOf = (conv: Conv, userId: string) => (conv.buyer_id === userId ? "buyer" : "seller");

async function assertCanMessage(sql: Sql, from: string, to: string) {
  if (await isClosedAccount(sql, from)) throw new Error("Hesabınız kapatılma sürecinde olduğu için mesaj gönderemezsiniz.");
  if (await blockedBetween(sql, from, to)) throw new Error("Bu kullanıcıyla mesajlaşamazsınız.");
  if (await isClosedAccount(sql, to)) throw new Error("Bu kullanıcı hesabını kapattı. Mesaj gönderilemez.");
}

/** Whether `viewer` may see when `other` read messages (other's privacy switch). */
async function readsVisible(sql: Sql, other: string): Promise<boolean> {
  const rows = await sql.query<{ read_receipts: boolean }>("select read_receipts from profiles where user_id=$1", [other]);
  return rows[0]?.read_receipts ?? true;
}

/**
 * Inserts a message row and reopens/unarchives the conversation inside `tx`.
 * Returns `{ msg, duplicated }` so callers only broadcast/notify after commit
 * and never re-notify on idempotent `clientId` retries.
 */
async function persistMessage(
  tx: Sql,
  conv: Conv,
  senderId: string,
  message: { content: string; kind?: ChatMessage["kind"]; meta?: ChatMessage["meta"]; replyTo?: string; clientId?: string },
): Promise<{ msg: ChatMessage; duplicated: boolean }> {
  const sentBefore = async () =>
    message.clientId
      ? (await tx.query<Record<string, unknown>>(
          `select ${MSG_COLUMNS} from messages where conversation_id=$1 and sender_id=$2 and client_id=$3`,
          [conv.id, senderId, message.clientId],
        ))[0]
      : undefined;
  // A retry of a message that already went out: answer with it, deliver nothing new.
  const earlier = await sentBefore();
  if (earlier) return { msg: mapMsg(earlier), duplicated: true };
  const id = newId("msg");
  // A reply may only quote a message from the same chat.
  const replyTo = message.replyTo
    ? ((await tx.query<{ id: string }>("select id from messages where id=$1 and conversation_id=$2", [message.replyTo, conv.id]))[0]?.id ?? null)
    : null;
  const rows = message.clientId
    ? await tx.query<Record<string, unknown>>(
        `insert into messages (id, conversation_id, sender_id, content, kind, meta, reply_to, client_id)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
         on conflict (conversation_id, sender_id, client_id) where client_id is not null do nothing
         returning ${MSG_COLUMNS}`,
        [id, conv.id, senderId, message.content, message.kind ?? "text", message.meta ? JSON.stringify(message.meta) : null, replyTo, message.clientId],
      )
    : await tx.query<Record<string, unknown>>(
        `insert into messages (id, conversation_id, sender_id, content, kind, meta, reply_to, client_id)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) returning ${MSG_COLUMNS}`,
        [id, conv.id, senderId, message.content, message.kind ?? "text", message.meta ? JSON.stringify(message.meta) : null, replyTo, null],
      );
  if (rows.length === 0) {
    const winner = await sentBefore();
    if (winner) return { msg: mapMsg(winner), duplicated: true };
    throw new Error("Mesaj kaydedilemedi.");
  }
  const receiver = otherOf(conv, senderId);
  await tx.query(`update conversations set updated_at=now(), ${sideOf(conv, receiver)}_archived_at=null where id=$1`, [conv.id]);
  await reopenConversation(tx, conv.id);
  return { msg: mapMsg(rows[0]), duplicated: false };
}

async function emitDelivered(sql: Sql, conv: Conv, senderId: string, msg: ChatMessage, contentPreview: string) {
  const receiver = otherOf(conv, senderId);
  broadcastChatMessage(conv.id, msg);
  broadcastUserInbox(receiver, { type: "new_message", conversationId: conv.id, message: msg });
  broadcastUserInbox(senderId, { type: "inbox_ping", conversationId: conv.id });
  if (!isViewingConversation(receiver, conv.id) && firstInWindow(`msgnotify:${receiver}:${conv.id}`, 2 * 60_000)) {
    const muteCol = conv.buyer_id === receiver ? "buyer_muted_until" : "seller_muted_until";
    const mutedRow = (await sql.query<{ muted: boolean }>(`select (${muteCol} is not null and ${muteCol} > now()) as muted from conversations where id=$1`, [conv.id]))[0];
    if (!mutedRow?.muted) {
      const sender = (await sql.query<{ display_name: string | null }>("select display_name from profiles where user_id=$1", [senderId]))[0];
      await notify(receiver, "message", sender?.display_name ? `${sender.display_name} size yazdı` : "Yeni mesaj", contentPreview.slice(0, 80), `/mesajlar/${conv.id}`);
    }
  }
}

/**
 * Store a message, reopen the chat for both sides, push it live and notify the
 * receiver unless they have the chat open or were notified about it recently.
 */
async function deliver(
  sql: Sql,
  conv: Conv,
  senderId: string,
  message: { content: string; kind?: ChatMessage["kind"]; meta?: ChatMessage["meta"]; replyTo?: string; clientId?: string },
): Promise<ChatMessage> {
  const { msg, duplicated } = await sql.transaction((tx) => persistMessage(tx, conv, senderId, message));
  if (!duplicated) await emitDelivered(sql, conv, senderId, msg, message.content);
  return msg;
}

export const startConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z
      .object({
        listingId: z.string(),
        content: z.string().trim().min(1, "Mesaj boş olamaz").max(2000).optional(),
        // An opening offer instead of (or after) a message: no filler text is sent.
        offer: z.number().int().min(1).max(1_000_000_000).optional(),
      })
      .refine((d) => d.content !== undefined || d.offer !== undefined, "Mesaj boş olamaz"),
  )
  .handler(async ({ context, data }) => {
    rateLimit(`msg:${context.userId}`, 40, 60_000);
    if (data.offer !== undefined) rateLimit(`offer:${context.userId}`, 10, 60_000);
    const sql = await getSql();
    await ensureProfile(context.userId);
    const listing = await sql.query<{ id: string; user_id: string; status: string; currency: string | null }>(
      "select id, user_id, status, currency from listings where id=$1 and (expires_at is null or expires_at > now())",
      [data.listingId],
    );
    if (!listing[0] || listing[0].status !== "ACTIVE") throw new Error("İlan bulunamadı");
    if (listing[0].user_id === context.userId) throw new Error("Kendi ilanınıza mesaj gönderemezsiniz.");
    await assertCanMessage(sql, context.userId, listing[0].user_id);
    const conv = await sql.transaction(async (tx) => {
      await tx.query(
        `insert into conversations (id, listing_id, buyer_id, seller_id) values ($1,$2,$3,$4)
         on conflict (listing_id, buyer_id) do update set updated_at = now()`,
        [newId("cnv"), data.listingId, context.userId, listing[0].user_id],
      );
      const c = (
        await tx.query<Conv>(
          "select id, buyer_id, seller_id, listing_id from conversations where listing_id=$1 and buyer_id=$2",
          [data.listingId, context.userId],
        )
      )[0];
      if (!c) throw new Error("Konuşma başlatılamadı.");
      return c;
    });
    if (data.content) await deliver(sql, conv, context.userId, { content: data.content });
    if (data.offer !== undefined) await deliverOffer(sql, conv, context.userId, data.offer, undefined, listing[0].currency ?? "TRY");
    return { conversationId: conv.id };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      conversationId: z.string(),
      content: z.string().trim().min(1, "Mesaj boş olamaz").max(2000),
      replyTo: z.string().max(60).optional(),
      /** Chosen by the app per message; the same id twice is delivered once. */
      clientId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    rateLimit(`msg:${context.userId}`, 40, 60_000);
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    await assertCanMessage(sql, context.userId, otherOf(conv, context.userId));
    return deliver(sql, conv, context.userId, { content: data.content.trim(), replyTo: data.replyTo, clientId: data.clientId });
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
/** A new offer card; earlier pending offers in the chat close (the countered one as "countered"). */
async function deliverOffer(sql: Sql, conv: Conv, userId: string, amount: number, counterTo?: string, currency = "TRY") {
  const content = `${counterTo ? "Karşı teklif" : "Teklif"}: ${formatPrice(amount, currency)}`;
  const { closed, msg, duplicated } = await sql.transaction(async (tx) => {
    // Lock the conversation row so parallel offers cannot leave two offers pending.
    await tx.query("select id from conversations where id=$1 for update", [conv.id]);
    if (counterTo) {
      const target = await tx.query<{ sender_id: string; meta: unknown }>(
        "select sender_id, meta from messages where id=$1 and conversation_id=$2 and kind='offer' and deleted_at is null for update",
        [counterTo, conv.id],
      );
      if (!target[0] || target[0].sender_id === userId || asJson<{ status?: string }>(target[0].meta, {}).status !== "pending") {
        throw new Error("Bu teklif artık geçerli değil.");
      }
    }
    const closedRows = await tx.query<Record<string, unknown>>(
      `update messages set meta = jsonb_set(meta, '{status}', to_jsonb(case when id = $2 then 'countered' else 'withdrawn' end))
       where conversation_id=$1 and kind='offer' and deleted_at is null and meta->>'status'='pending'
       returning ${MSG_COLUMNS}`,
      [conv.id, counterTo ?? ""],
    );
    const saved = await persistMessage(tx, conv, userId, {
      content,
      kind: "offer",
      meta: { amount, status: "pending", counter: Boolean(counterTo) },
    });
    return { closed: closedRows.map((m) => mapMsg(m)), ...saved };
  });
  for (const m of closed) broadcastChatUpdate(conv.id, m);
  if (!duplicated) await emitDelivered(sql, conv, userId, msg, content);
  return msg;
}

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
      ? (await sql.query<{ status: string; currency: string | null }>(
          "select status, currency from listings where id=$1 and (expires_at is null or expires_at > now())",
          [conv.listing_id],
        ))[0]
      : undefined;
    if (!listing || listing.status !== "ACTIVE") throw new Error("İlan yayında değil; teklif verilemez.");
    await assertCanMessage(sql, context.userId, otherOf(conv, context.userId));
    if (!data.counterTo && conv.buyer_id !== context.userId) {
      throw new Error("Satıcı yalnızca gelen bir teklife karşı teklif verebilir.");
    }
    if (!data.counterTo) {
      const sellerRows = await sql.query<{ user_prefs: unknown }>("select user_prefs from profiles where user_id=$1", [conv.seller_id]);
      const sellerPrefs = resolveUserPrefs(asJson(sellerRows[0]?.user_prefs, {})).seller_prefs;
      if (!sellerPrefs.accept_offers) {
        throw new Error("Bu satıcı ilanları için fiyat tekliflerini kapatmış.");
      }
    }
    return deliverOffer(sql, conv, context.userId, data.amount, data.counterTo, listing.currency ?? "TRY");
  });

/** The person who received a pending offer accepts or declines it. */
export const respondOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ messageId: z.string(), accept: z.boolean() }))
  .handler(async ({ context, data }) => {
    rateLimit(`offer-reply:${context.userId}`, 30, 60_000);
    const sql = await getSql();
    const { conv, offerer, meta, currency, updatedRow } = await sql.transaction(async (tx) => {
      const rows = await tx.query<{ conversation_id: string; sender_id: string; meta: unknown; currency: string | null }>(
        `select m.conversation_id, m.sender_id, m.meta, l.currency
         from messages m
         join conversations cv on cv.id = m.conversation_id
         left join listings l on l.id = cv.listing_id
         where m.id=$1 and m.kind='offer' and m.deleted_at is null
         for update of m`,
        [data.messageId],
      );
      if (!rows[0]) throw new Error("Teklif bulunamadı");
      const convRow = await myConversation(tx as unknown as Sql, rows[0].conversation_id, context.userId);
      await tx.query("select id from conversations where id=$1 for update", [convRow.id]);
      if (rows[0].sender_id === context.userId) throw new Error("Kendi teklifinize yanıt veremezsiniz.");
      const offererId = rows[0].sender_id;
      await assertCanMessage(tx as unknown as Sql, context.userId, offererId);
      const parsedMeta = asJson<{ amount?: number; status?: OfferStatus }>(rows[0].meta, {});
      if (parsedMeta.status !== "pending") throw new Error("Bu teklif artık geçerli değil.");
      if (data.accept) {
        const listing = convRow.listing_id
          ? (await tx.query<{ status: string }>("select status from listings where id=$1 and (expires_at is null or expires_at > now())", [convRow.listing_id]))[0]
          : undefined;
        if (listing?.status !== "ACTIVE") throw new Error("İlan artık yayında olmadığı için teklif kabul edilemez.");
      }
      const status: OfferStatus = data.accept ? "accepted" : "rejected";
      const updated = await tx.query<Record<string, unknown>>(
        `update messages set meta = jsonb_set(meta, '{status}', to_jsonb($2::text))
         where id=$1 and meta->>'status' = 'pending' returning ${MSG_COLUMNS}`,
        [data.messageId, status],
      );
      if (!updated[0]) throw new Error("Bu teklif artık geçerli değil.");
      return {
        conv: convRow,
        offerer: offererId,
        meta: parsedMeta,
        currency: rows[0].currency ?? "TRY",
        updatedRow: updated[0],
      };
    });
    const msg = mapMsg(updatedRow);
    broadcastChatUpdate(conv.id, msg);
    broadcastUserInbox(offerer, { type: "inbox_ping", conversationId: conv.id });
    await notify(
      offerer,
      "message",
      data.accept ? "Teklifiniz kabul edildi" : "Teklifiniz reddedildi",
      `${formatPrice(meta.amount ?? 0, currency)} teklifiniz ${data.accept ? "kabul edildi. Buluşmayı mesajlaşarak ayarlayabilirsiniz." : "reddedildi."}`,
      `/mesajlar/${conv.id}`,
    );
    return msg;
  });

/** Delete my own message for everyone, within an hour of sending. */
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ messageId: z.string() }))
  .handler(async ({ context, data }) => {
    rateLimit(`msg-del:${context.userId}`, 30, 60_000);
    const sql = await getSql();
    const { conversationId, receiver, updatedRow } = await sql.transaction(async (tx) => {
      const rows = await tx.query<{ conversation_id: string; sender_id: string; created_at: string; kind: string; meta: unknown; content: string }>(
        "select conversation_id, sender_id, created_at, kind, meta, content from messages where id=$1 and deleted_at is null for update",
        [data.messageId],
      );
      const m = rows[0];
      if (!m || m.sender_id !== context.userId) throw new Error("Mesaj bulunamadı");
      if (Date.now() - new Date(m.created_at).getTime() > DELETE_WINDOW_MS) {
        throw new Error("Mesajlar yalnızca gönderildikten sonraki 1 saat içinde silinebilir.");
      }
      if (m.kind === "offer") {
        const offerStatus = asJson<{ status?: string }>(m.meta, {}).status;
        if (offerStatus && offerStatus !== "pending") {
          throw new Error("Sonuçlanmış teklif kartları silinemez.");
        }
      }
      if (m.kind === "image") {
        const imageId = asJson<{ image_id?: string }>(m.meta, {}).image_id;
        // While a report on this chat is open the photo stays as evidence, unseen by the two people.
        const reported = await tx.query("select 1 from reports where conversation_id=$1 and status='OPEN' limit 1", [m.conversation_id]);
        if (imageId && !reported[0]) await tx.query("delete from chat_images where id=$1", [imageId]);
      }
      // A deleted IBAN or phone must not live on in the bell list or the push preview.
      const conv = (await tx.query<Conv>("select id, buyer_id, seller_id, listing_id from conversations where id=$1", [m.conversation_id]))[0];
      const otherUserId = conv ? otherOf(conv, context.userId) : null;
      if (otherUserId && m.kind !== "image") {
        await tx.query(
          "update notifications set body=$1 where user_id=$2 and type='message' and link=$3 and body=$4",
          [DELETED_MESSAGE_TEXT, otherUserId, `/mesajlar/${m.conversation_id}`, m.content.slice(0, 80)],
        );
      }
      const updated = await tx.query<Record<string, unknown>>(
        `update messages set deleted_at=now(), content=$2, meta=null where id=$1 returning ${MSG_COLUMNS}`,
        [data.messageId, DELETED_MESSAGE_TEXT],
      );
      return { conversationId: m.conversation_id, receiver: otherUserId, updatedRow: updated[0] };
    });
    const msg = mapMsg(updatedRow);
    broadcastChatUpdate(conversationId, msg);
    if (receiver) broadcastUserInbox(receiver, { type: "inbox_ping", conversationId });
    return msg;
  });

/** Inbox: my visible chats with the other person, listing, last message and unread count. */
export const listConversations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select cv.id, cv.listing_id, cv.buyer_id, cv.seller_id, cv.updated_at,
              l.title as listing_title, l.slug as listing_slug, l.images, l.price, l.currency, l.status as listing_status,
              op.display_name as other_name, op.avatar_url as other_avatar, coalesce(op.deletion_requested_at, op.banned_at) as other_closing,
              case when cv.buyer_id = $1 then cv.seller_id else cv.buyer_id end as other_id,
              case when cv.buyer_id = $1 then cv.buyer_archived_at else cv.seller_archived_at end as archived_at,
              case when cv.buyer_id = $1 then cv.buyer_marked_unread else cv.seller_marked_unread end as marked_unread,
              case when cv.buyer_id = $1 then cv.buyer_pinned_at else cv.seller_pinned_at end as pinned_at,
              case when cv.buyer_id = $1 then (cv.buyer_muted_until is not null and cv.buyer_muted_until > now()) else (cv.seller_muted_until is not null and cv.seller_muted_until > now()) end as muted,
              lm.content as last_content, lm.kind as last_kind, lm.sender_id as last_sender_id, lm.deleted_at as last_deleted,
              coalesce(u.n, 0) as unread,
              exists (
                select 1 from user_blocks b
                where (b.blocker_id = $1 and b.blocked_id = case when cv.buyer_id = $1 then cv.seller_id else cv.buyer_id end)
                   or (b.blocked_id = $1 and b.blocker_id = case when cv.buyer_id = $1 then cv.seller_id else cv.buyer_id end)
              ) as other_blocked
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
       order by (case when cv.buyer_id = $1 then cv.buyer_pinned_at else cv.seller_pinned_at end) desc nulls last, cv.updated_at desc
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
      currency: r.currency ? String(r.currency) : "TRY",
      other_id: String(r.other_id),
      other_name: r.other_name == null ? DELETED_USER_NAME : String(r.other_name),
      other_avatar: r.other_avatar ? String(r.other_avatar) : null,
      other_closed: r.other_name == null || r.other_closing != null,
      other_online: r.other_name != null && r.other_closing == null && !r.other_blocked && isOnline(String(r.other_id)),
      archived: r.archived_at != null,
      marked_unread: Boolean(r.marked_unread),
      pinned: r.pinned_at != null,
      muted: Boolean(r.muted),
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
      `select l.title, l.slug, l.images, l.price, l.currency, l.status as listing_status,
              op.display_name as other_name, op.avatar_url as other_avatar, op.last_seen_at as other_last_seen,
              coalesce(op.deletion_requested_at, op.banned_at) as other_closing, coalesce(op.read_receipts, true) as other_receipts,
              coalesce(mp.read_receipts, true) as my_receipts,
              case when cv.buyer_id = $3 then cv.buyer_pinned_at is not null else cv.seller_pinned_at is not null end as pinned,
              case when cv.buyer_id = $3 then (cv.buyer_muted_until is not null and cv.buyer_muted_until > now()) else (cv.seller_muted_until is not null and cv.seller_muted_until > now()) end as muted
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
    // Blocking in either direction also hides presence, so neither can watch the other.
    const blocked = Boolean(blockedByMeRows[0] || blockedByOtherRows[0]);
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
        listing_currency: h.currency ? String(h.currency) : "TRY",
        listing_status: h.listing_status ? String(h.listing_status) : "REMOVED",
        other_id: otherId,
        other_name: h.other_name == null ? DELETED_USER_NAME : String(h.other_name),
        other_closed: h.other_name == null || h.other_closing != null,
        other_avatar: h.other_avatar ? String(h.other_avatar) : null,
        other_online: !blocked && h.other_name != null && isOnline(otherId),
        other_last_seen: !blocked && h.other_last_seen ? asIso(h.other_last_seen) : null,
        buyer_id: conv.buyer_id,
        seller_id: conv.seller_id,
        pinned: Boolean(h.pinned),
        muted: Boolean(h.muted),
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
    if (!Number.isFinite(Date.parse(data.before))) return { messages: [], hasMore: false };
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
      `select ${MSG_COLUMNS} from messages
       where conversation_id=$1 and (created_at > $2::timestamptz or updated_at > $2::timestamptz)
       order by created_at asc limit 100`,
      [conv.id, afterIso],
    );
    const reads = showReads
      ? await sql.query<{ id: string; read_at: string }>(
          "select id, read_at from messages where conversation_id=$1 and sender_id=$2 and read_at > $3::timestamptz - interval '60 seconds'",
          [conv.id, context.userId, afterIso],
        )
      : [];
    const blocked = await blockedBetween(sql, context.userId, otherId);
    const lastSeen = blocked ? [] : await sql.query<{ last_seen_at: string | null }>("select last_seen_at from profiles where user_id=$1", [otherId]);
    return {
      messages: fresh.map((m) => mapMsg(m, !showReads && String(m.sender_id) === context.userId)),
      reads: reads.map((r) => ({ id: String(r.id), read_at: asIso(r.read_at) })),
      other_online: !blocked && isOnline(otherId),
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
    // Read means caught up: the next message may notify again, even within the quiet window.
    resetWindow(`msgnotify:${context.userId}:${conv.id}`);
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
    // The chat is read, so its "Yeni mesaj" bell notifications are too.
    await sql.query("update notifications set read_at=now() where user_id=$1 and link=$2 and read_at is null", [
      context.userId,
      `/mesajlar/${conv.id}`,
    ]);
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
    const conv = await myConversation(sql, data.conversationId, context.userId);
    if (await blockedBetween(sql, context.userId, otherOf(conv, context.userId))) return { ok: true };
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
    if (!data.unread) {
      // "Okundu" means the messages too; otherwise the badge stays.
      const reads = await sql.query<{ id: string; read_at: unknown }>(
        "update messages set read_at=now() where conversation_id=$1 and sender_id<>$2 and read_at is null returning id, read_at",
        [conv.id, context.userId],
      );
      await sql.query("update notifications set read_at=now() where user_id=$1 and type='message' and link=$2 and read_at is null", [
        context.userId,
        `/mesajlar/${conv.id}`,
      ]);
      if (reads.length) {
        broadcastChatRead(
          conv.id,
          reads.map((r) => ({ id: r.id, read_at: asIso(r.read_at) })),
        );
      }
    }
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
    const reported = data.messageId
      ? (await sql.query<{ id: string; created_at: unknown }>("select id, created_at from messages where id=$1 and conversation_id=$2", [data.messageId, conv.id]))[0]
      : undefined;
    const messageId = reported?.id ?? null;
    // One open report per message, so a later abusive message still reaches moderators.
    const open = await sql.query("select 1 from reports where conversation_id=$1 and reporter_id=$2 and status='OPEN' and message_id is not distinct from $3 limit 1", [
      conv.id,
      context.userId,
      messageId,
    ]);
    if (open[0]) return { ok: true };
    // What moderators read later: the chat as it stands now, around the reported message.
    const columns = "id, sender_id, content, kind, meta, created_at";
    const excerpt = reported
      ? await sql.query<Record<string, unknown>>(
          `select * from (
             (select ${columns} from messages where conversation_id=$1 and created_at <= $2 and deleted_at is null order by created_at desc limit 8)
             union all
             (select ${columns} from messages where conversation_id=$1 and created_at > $2 and deleted_at is null order by created_at asc limit 5)
           ) m order by created_at`,
          [conv.id, reported.created_at],
        )
      : await sql.query<Record<string, unknown>>(
          `select * from (select ${columns} from messages where conversation_id=$1 and deleted_at is null order by created_at desc limit 12) m order by created_at`,
          [conv.id],
        );
    const evidence = {
      target_id: otherOf(conv, context.userId),
      messages: excerpt.map((m) => ({
        id: String(m.id),
        sender_id: String(m.sender_id),
        content: String(m.content),
        kind: String(m.kind ?? "text"),
        image_id: asJson<{ image_id?: string }>(m.meta, {}).image_id ?? null,
        created_at: asIso(m.created_at),
      })),
    };
    try {
      await sql.query(
        "insert into reports (id, listing_id, reporter_id, reason, details, conversation_id, message_id, evidence) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",
        [newId("rep"), conv.listing_id, context.userId, data.reason, data.details || null, conv.id, messageId, JSON.stringify(evidence)],
      );
    } catch (err) {
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") return { ok: true };
      throw err;
    }
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
          and ${chatVisibleTo("$1")}
          and (case when cv.buyer_id=$1 then cv.buyer_archived_at else cv.seller_archived_at end) is null
          -- A marked chat that also has unread messages is already counted above.
          and not exists (select 1 from messages m where m.conversation_id = cv.id and m.read_at is null and m.sender_id <> $1)) as n`,
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
  const content = "📷 Fotoğraf";
  const { msg, duplicated } = await sql.transaction(async (tx) => {
    await tx.query(
      "insert into chat_images (id, conversation_id, uploader_id, mime_type, data) values ($1,$2,$3,'image/webp',$4)",
      [imageId, conv.id, userId, data],
    );
    return persistMessage(tx, conv, userId, { content, kind: "image", meta: { image_id: imageId } });
  });
  if (!duplicated) await emitDelivered(sql, conv, userId, msg, content);
  return msg;
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

type QuerySql = { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> };

/**
 * Seller responsiveness over the last 90 days for conversations where the buyer
 * sent at least one message. Returns null when fewer than 3 conversations qualify.
 */
export async function getSellerResponseStats(
  sql: QuerySql,
  sellerId: string,
): Promise<{ responseRate: number; avgReplyMinutes: number } | null> {
  const rows = await sql.query<{ total: number; replied: number; avg_minutes: number }>(
    `with conv_incoming as (
       select c.id, min(m.created_at) as first_in
       from conversations c
       join messages m on m.conversation_id = c.id
       where c.seller_id = $1
         and m.sender_id <> $1
         and m.deleted_at is null
         and m.created_at >= now() - interval '90 days'
       group by c.id
     ),
     conv_replies as (
       select ci.id,
              ci.first_in,
              min(r.created_at) as first_reply
       from conv_incoming ci
       left join messages r
         on r.conversation_id = ci.id
        and r.sender_id = $1
        and r.deleted_at is null
        and r.created_at >= ci.first_in
       group by ci.id, ci.first_in
     )
     select count(*)::int as total,
            count(first_reply)::int as replied,
            coalesce(
              avg(extract(epoch from (first_reply - first_in)) / 60.0) filter (where first_reply is not null),
              0
            )::float8 as avg_minutes
     from conv_replies`,
    [sellerId],
  );
  const row = rows[0];
  if (!row || row.total < 3) return null;
  return {
    responseRate: Math.round((row.replied / row.total) * 100),
    avgReplyMinutes: Math.max(0, Math.round(row.avg_minutes)),
  };
}

export const pinConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), pinned: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    const col = `${sideOf(conv, context.userId)}_pinned_at`;
    await sql.query(`update conversations set ${col}=${data.pinned ? "now()" : "null"} where id=$1`, [conv.id]);
    return { ok: true, pinned: data.pinned };
  });

export const muteConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), muted: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await myConversation(sql, data.conversationId, context.userId);
    const col = `${sideOf(conv, context.userId)}_muted_until`;
    await sql.query(
      `update conversations set ${col}=${data.muted ? "now() + interval '100 years'" : "null"} where id=$1`,
      [conv.id],
    );
    return { ok: true, muted: data.muted };
  });

export const editMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ messageId: z.string(), content: z.string().trim().min(1).max(2000) }))
  .handler(async ({ context, data }) => {
    rateLimit(`chat-edit:${context.userId}`, 30, 60_000);
    const sql = await getSql();
    const result = await sql.transaction(async (tx) => {
      const rows = await tx.query<{
        id: string;
        conversation_id: string;
        sender_id: string;
        created_at: string;
        kind: string;
      }>(
        "select id, conversation_id, sender_id, created_at, kind from messages where id=$1 and deleted_at is null for update",
        [data.messageId],
      );
      const m = rows[0];
      if (!m) throw new Error("Mesaj bulunamadı.");
      if (m.sender_id !== context.userId) throw new Error("Yalnızca kendi mesajınızı düzenleyebilirsiniz.");
      if (m.kind !== "text") throw new Error("Yalnızca metin mesajları düzenlenebilir.");
      if (Date.now() - new Date(m.created_at).getTime() > EDIT_WINDOW_MS) {
        throw new Error("Mesajlar yalnızca ilk 15 dakika içinde düzenlenebilir.");
      }
      const updated = await tx.query<Record<string, unknown>>(
        `update messages set content=$2, edited_at=now(), updated_at=now() where id=$1 returning ${MSG_COLUMNS}`,
        [data.messageId, data.content],
      );
      return {
        conversationId: m.conversation_id,
        message: mapMsg(updated[0]),
      };
    });
    broadcastChatUpdate(result.conversationId, result.message);
    return { message: result.message };
  });
