import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getMobileUserId } from "@/lib/server/mobile-auth";
import { asIso, asJson, newId, LISTING_PHOTO_MSG } from "@/lib/utils";
import { notify, rateLimit } from "@/lib/server/helpers";
import { broadcastChatMessage, broadcastChatRead, broadcastUserInbox } from "@/lib/server/chat-bus";
import { hasUserBlock } from "@/lib/server/user-blocks";
import { insertConversationMessage, loadConversationThread } from "@/lib/server/mobile-conversation-store";

export const Route = createFileRoute("/api/mobile/conversations/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const sql = await getSql();
          const loaded = await loadConversationThread(sql, params.id, userId);
          if (!loaded) return Response.json({ success: false, error: "Konuşma bulunamadı." }, { status: 404 });
          const { conversation: convo, blockedByMe, blockedByOther, unread, messages: messageRows } = loaded;
          if (unread.length) {
            const readAt = new Date().toISOString();
            broadcastChatRead(params.id, unread.map((item) => ({ id: item.id, read_at: readAt })));
            broadcastUserInbox(String(convo.buyer_id), { type: "read_update", conversationId: params.id });
            broadcastUserInbox(String(convo.seller_id), { type: "read_update", conversationId: params.id });
          }
          return Response.json({
            success: true,
            thread: {
              id: String(convo.id), listing_id: convo.listing_id ? String(convo.listing_id) : "",
              listing_title: String(convo.listing_title ?? "İlan kaldırıldı"),
              listing_image: convo.images ? (asJson<string[]>(convo.images, [])[0] ?? null) : null,
              listing_price: convo.price == null ? null : Number(convo.price),
              other_user_name: String(convo.other_name ?? "Üye"), other_user_id: String(convo.other_id),
              blocked: blockedByMe || blockedByOther,
              blockedByMe,
              blockedByOther,
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
          if (await hasUserBlock(sql, userId, receiver)) return Response.json({ success: false, error: "Bu kullanıcıyla mesajlaşamazsınız." }, { status: 403 });
          const id = newId("msg");
          const row = await insertConversationMessage(sql, id, params.id, userId, body.content.trim());
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
