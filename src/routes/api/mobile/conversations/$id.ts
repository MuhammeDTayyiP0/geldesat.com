import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getMobileUserId } from "@/lib/server/mobile-auth";
import { asIso, asJson, newId, LISTING_PHOTO_MSG } from "@/lib/utils";
import { notify, rateLimit } from "@/lib/server/helpers";
import { broadcastChatMessage, broadcastChatRead, broadcastUserInbox } from "@/lib/server/chat-bus";

async function isBlocked(a: string, b: string) {
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    "select id from user_blocks where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1) limit 1",
    [a, b],
  );
  return Boolean(rows[0]);
}

export const Route = createFileRoute("/api/mobile/conversations/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>(
            `select cv.*, l.title as listing_title, l.images, l.price,
                    case when cv.buyer_id=$2 then sp.display_name else bp.display_name end as other_name,
                    case when cv.buyer_id=$2 then cv.seller_id else cv.buyer_id end as other_id
             from conversations cv left join listings l on l.id=cv.listing_id
             left join profiles bp on bp.user_id=cv.buyer_id left join profiles sp on sp.user_id=cv.seller_id
             where cv.id=$1 and (cv.buyer_id=$2 or cv.seller_id=$2) limit 1`,
            [params.id, userId],
          );
          if (!rows[0]) return Response.json({ success: false, error: "Konuşma bulunamadı." }, { status: 404 });
          const convo = rows[0];
          const otherUserId = String(convo.buyer_id === userId ? convo.seller_id : convo.buyer_id);
          const [blockedByMeRows, blockedByOtherRows] = await Promise.all([
            sql.query<{ id: string }>("select id from user_blocks where blocker_id=$1 and blocked_id=$2 limit 1", [userId, otherUserId]),
            sql.query<{ id: string }>("select id from user_blocks where blocker_id=$1 and blocked_id=$2 limit 1", [otherUserId, userId]),
          ]);
          const unread = await sql.query<{ id: string }>(
            "select id from messages where conversation_id=$1 and sender_id<>$2 and read_at is null",
            [params.id, userId],
          );
          if (unread.length) {
            await sql.query("update messages set read_at=now() where conversation_id=$1 and sender_id<>$2 and read_at is null", [params.id, userId]);
            const readAt = new Date().toISOString();
            broadcastChatRead(params.id, unread.map((item) => ({ id: item.id, read_at: readAt })));
            broadcastUserInbox(String(convo.buyer_id), { type: "read_update", conversationId: params.id });
            broadcastUserInbox(String(convo.seller_id), { type: "read_update", conversationId: params.id });
          }
          const messageRows = await sql.query<Record<string, unknown>>(
            "select id,sender_id,content,created_at,read_at from messages where conversation_id=$1 order by created_at asc",
            [params.id],
          );
          return Response.json({
            success: true,
            thread: {
              id: String(convo.id), listing_id: convo.listing_id ? String(convo.listing_id) : "",
              listing_title: String(convo.listing_title ?? "İlan kaldırıldı"),
              listing_image: convo.images ? (asJson<string[]>(convo.images, [])[0] ?? null) : null,
              listing_price: convo.price == null ? null : Number(convo.price),
              other_user_name: String(convo.other_name ?? "Üye"), other_user_id: String(convo.other_id),
              blocked: blockedByMeRows.length > 0 || blockedByOtherRows.length > 0,
              blockedByMe: blockedByMeRows.length > 0,
              blockedByOther: blockedByOtherRows.length > 0,
              messages: messageRows.map((m) => ({ id: String(m.id), sender_id: String(m.sender_id), content: String(m.content), created_at: asIso(m.created_at), read_at: m.read_at ? asIso(m.read_at) : null })),
            },
          }, { headers: { "Cache-Control": "private, no-store" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Mesajlar yüklenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request, params }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Mesaj göndermek için giriş yapın." }, { status: 401 });
          const body = await request.json() as { content?: unknown };
          if (typeof body.content !== "string" || !body.content.trim() || body.content.length > 2000) return Response.json({ success: false, error: "Mesajı kontrol edin." }, { status: 400 });
          rateLimit(`msg:${userId}`, 40, 60_000);
          const sql = await getSql();
          const conv = await sql.query<{ id: string; buyer_id: string; seller_id: string }>("select id,buyer_id,seller_id from conversations where id=$1", [params.id]);
          if (!conv[0]) return Response.json({ success: false, error: "Konuşma bulunamadı." }, { status: 404 });
          if (conv[0].buyer_id !== userId && conv[0].seller_id !== userId) return Response.json({ success: false, error: "Yetkisiz işlem." }, { status: 403 });
          const receiver = conv[0].buyer_id === userId ? conv[0].seller_id : conv[0].buyer_id;
          if (await isBlocked(userId, receiver)) return Response.json({ success: false, error: "Bu kullanıcıyla mesajlaşamazsınız." }, { status: 403 });
          const id = newId("msg");
          const inserted = await sql.query<Record<string, unknown>>(
            "insert into messages (id,conversation_id,sender_id,content) values ($1,$2,$3,$4) returning id,sender_id,content,created_at,read_at",
            [id, params.id, userId, body.content.trim()],
          );
          await sql.query("update conversations set updated_at=now() where id=$1", [params.id]);
          const row = inserted[0];
          const message = { id: String(row.id), sender_id: String(row.sender_id), content: String(row.content), created_at: asIso(row.created_at), read_at: row.read_at ? asIso(row.read_at) : null };
          broadcastChatMessage(params.id, message);
          broadcastUserInbox(receiver, { type: "new_message", conversationId: params.id, message });
          broadcastUserInbox(userId, { type: "inbox_ping", conversationId: params.id });
          await notify(receiver, "message", "Yeni mesaj", message.content === LISTING_PHOTO_MSG ? "İlan görseli" : message.content.slice(0, 80), `/mesajlar/${params.id}`);
          return Response.json({ success: true, message });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Mesaj gönderilemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
