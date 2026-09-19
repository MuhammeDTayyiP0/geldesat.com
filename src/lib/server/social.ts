import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { newId, num, asJson, asIso, LISTING_PHOTO_MSG } from "@/lib/utils";
import { ensureProfile, mapListing, notify, rateLimit } from "./helpers";
import { sweepExpiryReminders } from "./ops";
import { broadcastChatMessage, broadcastChatRead } from "./chat-bus";

function mapMsg(m: Record<string, unknown>) {
  return {
    id: String(m.id),
    sender_id: String(m.sender_id),
    content: String(m.content),
    created_at: asIso(m.created_at),
    read_at: m.read_at ? asIso(m.read_at) : null,
  };
}

async function blockedBetween(a: string, b: string) {
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select 1 as n from user_blocks
     where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1)
     limit 1`,
    [a, b],
  );
  return Boolean(rows[0]);
}

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ listingId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    const ex = await sql.query<{ user_id: string }>(
      "select user_id from favorites where user_id=$1 and listing_id=$2",
      [context.userId, data.listingId],
    );
    if (ex[0]) {
      await sql.query("delete from favorites where user_id=$1 and listing_id=$2", [context.userId, data.listingId]);
      return { favorite: false };
    }
    await sql.query("insert into favorites (user_id, listing_id) values ($1,$2)", [context.userId, data.listingId]);
    const owner = await sql.query<{ user_id: string; title: string; slug: string }>(
      "select user_id, title, slug from listings where id=$1",
      [data.listingId],
    );
    if (owner[0] && owner[0].user_id !== context.userId) {
      await notify(owner[0].user_id, "favorite", "İlanınız favorilendi", owner[0].title, `/ilan/${owner[0].slug}`);
    }
    return { favorite: true };
  });

export const myFavorites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select l.*, c.name as category_name, c.slug as category_slug,
              coalesce((select json_agg(b.kind) from boosts b where b.listing_id = l.id and b.ends_at > now()), '[]'::json) as boosts
       from favorites f
       join listings l on l.id = f.listing_id
       join categories c on c.id = l.category_id
       where f.user_id=$1 and l.status='ACTIVE'
       order by f.created_at desc`,
      [context.userId],
    );
    return rows.map(mapListing);
  });

export const favoriteIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ listing_id: string }>(
      "select listing_id from favorites where user_id=$1",
      [context.userId],
    );
    return rows.map((r) => r.listing_id);
  });

export const startConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      listingId: z.string(),
      content: z.string().trim().min(1, "Mesaj boş olamaz").max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    rateLimit(`msg:${context.userId}`, 40, 60_000);
    const sql = await getSql();
    await ensureProfile(context.userId);
    const listing = await sql.query<{ id: string; user_id: string; title: string; slug: string; status: string }>(
      "select id, user_id, title, slug, status from listings where id=$1 and (expires_at is null or expires_at > now())",
      [data.listingId],
    );
    if (!listing[0] || listing[0].status !== "ACTIVE") throw new Error("İlan bulunamadı");
    if (listing[0].user_id === context.userId) throw new Error("Kendi ilanınıza mesaj gönderemezsiniz.");
    if (await blockedBetween(context.userId, listing[0].user_id)) {
      throw new Error("Bu kullanıcıyla mesajlaşamazsınız.");
    }
    const id = newId("cnv");
    await sql.query(
      `insert into conversations (id, listing_id, buyer_id, seller_id)
       values ($1,$2,$3,$4)
       on conflict (listing_id, buyer_id) do update set updated_at = now()`,
      [id, data.listingId, context.userId, listing[0].user_id],
    );
    const conv = await sql.query<{ id: string }>(
      "select id from conversations where listing_id=$1 and buyer_id=$2",
      [data.listingId, context.userId],
    );
    const convId = conv[0]?.id || id;
    const msgId = newId("msg");
    const inserted = await sql.query<{ id: string; sender_id: string; content: string; created_at: string; read_at: string | null }>(
      "insert into messages (id, conversation_id, sender_id, content) values ($1,$2,$3,$4) returning id, sender_id, content, created_at, read_at",
      [msgId, convId, context.userId, data.content.trim()],
    );
    await sql.query("update conversations set updated_at=now() where id=$1", [convId]);
    const msg = mapMsg(inserted[0] ?? { id: msgId, sender_id: context.userId, content: data.content.trim(), created_at: new Date().toISOString(), read_at: null });
    broadcastChatMessage(convId, msg);
    await notify(
      listing[0].user_id,
      "message",
      "Yeni mesaj",
      data.content.slice(0, 80),
      `/mesajlar/${convId}`,
    );
    return { conversationId: convId };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), content: z.string().trim().min(1, "Mesaj boş olamaz").max(2000) }))
  .handler(async ({ context, data }) => {
    rateLimit(`msg:${context.userId}`, 40, 60_000);
    const sql = await getSql();
    const conv = await sql.query<{ id: string; buyer_id: string; seller_id: string }>(
      "select id, buyer_id, seller_id from conversations where id=$1",
      [data.conversationId],
    );
    if (!conv[0]) throw new Error("Konuşma yok");
    if (conv[0].buyer_id !== context.userId && conv[0].seller_id !== context.userId) {
      throw new Error("Yetkisiz işlem");
    }
    const receiver = conv[0].buyer_id === context.userId ? conv[0].seller_id : conv[0].buyer_id;
    if (await blockedBetween(context.userId, receiver)) {
      throw new Error("Bu kullanıcıyla mesajlaşamazsınız.");
    }
    const id = newId("msg");
    const inserted = await sql.query<{ id: string; sender_id: string; content: string; created_at: string; read_at: string | null }>(
      "insert into messages (id, conversation_id, sender_id, content) values ($1,$2,$3,$4) returning id, sender_id, content, created_at, read_at",
      [id, data.conversationId, context.userId, data.content.trim()],
    );
    await sql.query("update conversations set updated_at=now() where id=$1", [data.conversationId]);
    const msg = mapMsg(inserted[0] ?? { id, sender_id: context.userId, content: data.content.trim(), created_at: new Date().toISOString(), read_at: null });
    broadcastChatMessage(data.conversationId, msg);
    await notify(
      receiver,
      "message",
      "Yeni mesaj",
      msg.content === LISTING_PHOTO_MSG ? "İlan görseli" : msg.content.slice(0, 80),
      `/mesajlar/${data.conversationId}`,
    );
    return msg;
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select cv.*, l.title as listing_title, l.slug as listing_slug, l.images,
              l.price, l.currency,
              case when cv.buyer_id = $1 then sp.display_name else bp.display_name end as other_name,
              case when cv.buyer_id = $1 then cv.seller_id else cv.buyer_id end as other_id,
              (select content from messages m where m.conversation_id=cv.id order by created_at desc limit 1) as last_content,
              (select sender_id from messages m where m.conversation_id=cv.id order by created_at desc limit 1) as last_sender_id,
              (select count(*)::int from messages m where m.conversation_id=cv.id and m.sender_id <> $1 and m.read_at is null) as unread
       from conversations cv
       left join listings l on l.id = cv.listing_id
       left join profiles bp on bp.user_id = cv.buyer_id
       left join profiles sp on sp.user_id = cv.seller_id
       where cv.buyer_id=$1 or cv.seller_id=$1
       order by cv.updated_at desc`,
      [context.userId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      listing_id: r.listing_id ? String(r.listing_id) : "",
      listing_title: r.listing_title ? String(r.listing_title) : "İlan kaldırıldı",
      listing_slug: r.listing_slug ? String(r.listing_slug) : "",
      listing_image: r.images ? (asJson<string[]>(r.images, [])[0] ?? null) : null,
      other_name: String(r.other_name ?? "Üye"),
      other_id: String(r.other_id),
      last_content:
        r.last_content == null
          ? ""
          : String(r.last_content) === LISTING_PHOTO_MSG
            ? "İlan görseli"
            : String(r.last_content),
      last_sender_id: r.last_sender_id ? String(r.last_sender_id) : "",
      unread: num(r.unread),
      updated_at: asIso(r.updated_at),
      price: r.price ? num(r.price) : 0,
    }));
  });

export const getThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await sql.query<Record<string, unknown>>(
      `select cv.*, l.title, l.slug, l.images, l.price,
              case when cv.buyer_id = $2 then sp.display_name else bp.display_name end as other_name
       from conversations cv
       left join listings l on l.id = cv.listing_id
       left join profiles bp on bp.user_id = cv.buyer_id
       left join profiles sp on sp.user_id = cv.seller_id
       where cv.id=$1`,
      [data.conversationId, context.userId],
    );
    if (!conv[0]) throw new Error("Konuşma yok");
    if (String(conv[0].buyer_id) !== context.userId && String(conv[0].seller_id) !== context.userId) {
      throw new Error("Yetkisiz işlem");
    }
    const otherId = String(conv[0].buyer_id === context.userId ? conv[0].seller_id : conv[0].buyer_id);
    const [blockedByMeRows, blockedByOtherRows] = await Promise.all([
      sql.query<{ n: number }>("select 1 as n from user_blocks where blocker_id=$1 and blocked_id=$2 limit 1", [context.userId, otherId]),
      sql.query<{ n: number }>("select 1 as n from user_blocks where blocker_id=$1 and blocked_id=$2 limit 1", [otherId, context.userId]),
    ]);
    const blockedByMe = Boolean(blockedByMeRows[0]);
    const blockedByOther = Boolean(blockedByOtherRows[0]);
    const isBlocked = blockedByMe || blockedByOther;

    // Okunmamış mesaj varsa tek seferde güncelle ve karşı tarafa okundu yayını yap
    const unread = await sql.query<{ id: string }>(
      "select id from messages where conversation_id=$1 and sender_id<>$2 and read_at is null",
      [data.conversationId, context.userId],
    );
    if (unread.length > 0) {
      await sql.query(
        "update messages set read_at=now() where conversation_id=$1 and sender_id<>$2 and read_at is null",
        [data.conversationId, context.userId],
      );
      const nowIso = new Date().toISOString();
      broadcastChatRead(data.conversationId, unread.map((u) => ({ id: u.id, read_at: nowIso })));
    }

    const messages = await sql.query<Record<string, unknown>>(
      "select id, sender_id, content, created_at, read_at from messages where conversation_id=$1 order by created_at asc",
      [data.conversationId],
    );
    return {
      conversation: {
        id: String(conv[0].id),
        listing_id: conv[0].listing_id ? String(conv[0].listing_id) : "",
        listing_title: conv[0].title ? String(conv[0].title) : "İlan kaldırıldı",
        listing_slug: conv[0].slug ? String(conv[0].slug) : "",
        listing_image: conv[0].images ? (asJson<string[]>(conv[0].images, [])[0] ?? null) : null,
        listing_price: conv[0].price ? num(conv[0].price) : null,
        other_name: String(conv[0].other_name ?? "Üye"),
        buyer_id: String(conv[0].buyer_id),
        seller_id: String(conv[0].seller_id),
      },
      messages: messages.map((m) => mapMsg(m)),
      otherId,
      isBlocked,
      blockedByMe,
      blockedByOther,
    };
  });

export const pollThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ conversationId: z.string(), after: z.string().optional() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await sql.query<{ buyer_id: string; seller_id: string }>(
      "select buyer_id, seller_id from conversations where id=$1",
      [data.conversationId],
    );
    if (!conv[0]) throw new Error("Konuşma yok");
    if (conv[0].buyer_id !== context.userId && conv[0].seller_id !== context.userId) {
      throw new Error("Yetkisiz işlem");
    }

    // Yalnızca okunmamış mesaj varsa güncelle (veritabanı satır kilidini önler)
    const unread = await sql.query<{ id: string }>(
      "select id from messages where conversation_id=$1 and sender_id<>$2 and read_at is null",
      [data.conversationId, context.userId],
    );
    if (unread.length > 0) {
      await sql.query(
        "update messages set read_at=now() where conversation_id=$1 and sender_id<>$2 and read_at is null",
        [data.conversationId, context.userId],
      );
      const nowIso = new Date().toISOString();
      broadcastChatRead(data.conversationId, unread.map((u) => ({ id: u.id, read_at: nowIso })));
    }

    const after = data.after ? new Date(data.after) : null;
    const afterIso = after && !Number.isNaN(after.getTime()) ? after.toISOString() : null;
    const messages = afterIso
      ? await sql.query<Record<string, unknown>>(
          "select id, sender_id, content, created_at, read_at from messages where conversation_id=$1 and created_at > $2::timestamptz order by created_at asc",
          [data.conversationId, afterIso],
        )
      : await sql.query<Record<string, unknown>>(
          "select id, sender_id, content, created_at, read_at from messages where conversation_id=$1 order by created_at asc",
          [data.conversationId],
        );
    const reads = await sql.query<{ id: string; read_at: string }>(
      "select id, read_at from messages where conversation_id=$1 and sender_id=$2 and read_at is not null",
      [data.conversationId, context.userId],
    );
    return {
      messages: messages.map((m) => mapMsg(m)),
      reads: reads.map((r) => ({ id: String(r.id), read_at: asIso(r.read_at) })),
    };
  });

export const reportListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ listingId: z.string(), reason: z.string().min(3).max(80), details: z.string().max(500).optional() }))
  .handler(async ({ context, data }) => {
    rateLimit(`report:${context.userId}`, 10, 60_000);
    const sql = await getSql();
    await ensureProfile(context.userId);
    await sql.query(
      "insert into reports (id, listing_id, reporter_id, reason, details) values ($1,$2,$3,$4,$5)",
      [newId("rep"), data.listingId, context.userId, data.reason, data.details || null],
    );
    return { ok: true };
  });

export const leaveReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      sellerId: z.string(),
      listingId: z.string().optional(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (data.sellerId === context.userId) throw new Error("Kendinizi puanlayamazsınız");
    const sql = await getSql();
    await ensureProfile(context.userId);
    const talked = await sql.query<{ id: string }>(
      `select id from conversations
       where (buyer_id=$1 and seller_id=$2) or (buyer_id=$2 and seller_id=$1)
       limit 1`,
      [context.userId, data.sellerId],
    );
    if (!talked[0]) throw new Error("Yalnızca mesajlaştığınız satıcıları puanlayabilirsiniz.");
    await sql.query("delete from reviews where seller_id=$1 and reviewer_id=$2 and listing_id is not distinct from $3", [
      data.sellerId,
      context.userId,
      data.listingId || null,
    ]);
    await sql.query(
      `insert into reviews (id, seller_id, reviewer_id, listing_id, rating, comment)
       values ($1,$2,$3,$4,$5,$6)`,
      [newId("rev"), data.sellerId, context.userId, data.listingId || null, data.rating, data.comment || null],
    );
    return { ok: true };
  });

export const myNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      "select * from notifications where user_id=$1 order by created_at desc limit 50",
      [context.userId],
    );
    return rows.map((n) => ({
      id: String(n.id),
      type: String(n.type),
      title: String(n.title),
      body: n.body ? String(n.body) : "",
      link: n.link ? String(n.link) : "/",
      read: Boolean(n.read_at),
      created_at: String(n.created_at),
    }));
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql.query("update notifications set read_at=now() where user_id=$1 and read_at is null", [context.userId]);
    return { ok: true };
  });

export const unreadCount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    void sweepExpiryReminders().catch(() => undefined);
    const sql = await getSql();
    const a = await sql.query<{ n: number }>(
      "select count(*)::int as n from notifications where user_id=$1 and read_at is null",
      [context.userId],
    );
    const b = await sql.query<{ n: number }>(
      `select count(*)::int as n from messages m
       join conversations c on c.id = m.conversation_id
       where m.read_at is null and m.sender_id <> $1 and (c.buyer_id=$1 or c.seller_id=$1)`,
      [context.userId],
    );
    return { notifications: a[0]?.n ?? 0, messages: b[0]?.n ?? 0 };
  });

export const saveSearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ label: z.string().max(60).optional(), query: z.string().optional(), filters: z.record(z.string(), z.unknown()) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      "insert into saved_searches (id, user_id, label, query, filters) values ($1,$2,$3,$4,$5::jsonb)",
      [newId("ss"), context.userId, data.label || data.query || "Kayıtlı arama", data.query || "", JSON.stringify(data.filters)],
    );
    return { ok: true };
  });

export const mySavedSearches = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      "select id, label, query, filters, created_at from saved_searches where user_id=$1 order by created_at desc",
      [context.userId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      label: String(r.label ?? ""),
      query: String(r.query ?? ""),
      filters: String(typeof r.filters === "string" ? r.filters : JSON.stringify(r.filters ?? {})),
      created_at: String(r.created_at),
    }));
  });

export const deleteSavedSearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query("delete from saved_searches where id=$1 and user_id=$2", [data.id, context.userId]);
    return { ok: true };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string() }))
  .handler(async ({ context, data }) => {
    if (data.userId === context.userId) throw new Error("Kendinizi engelleyemezsiniz");
    const sql = await getSql();
    await sql.query(
      "insert into user_blocks (blocker_id, blocked_id) values ($1,$2) on conflict (blocker_id, blocked_id) do nothing",
      [context.userId, data.userId],
    );
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query("delete from user_blocks where blocker_id=$1 and blocked_id=$2", [context.userId, data.userId]);
    return { ok: true };
  });

