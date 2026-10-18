import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getMobileUserId } from "@/lib/server/mobile-auth";
import { asIso, asJson, newId, num, LISTING_PHOTO_MSG } from "@/lib/utils";
import { ensureProfile, notify, rateLimit } from "@/lib/server/helpers";
import { broadcastChatMessage, broadcastUserInbox } from "@/lib/server/chat-bus";
import { createOrGetConversation, insertConversationMessage } from "@/lib/server/mobile-conversation-store";
import { hasUserBlock } from "@/lib/server/user-blocks";

export const Route = createFileRoute("/api/mobile/conversations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const sql = await getSql();
          const rows = await sql.query<Record<string, unknown>>(
            `select cv.*, l.title as listing_title, l.slug as listing_slug, l.images, l.price, l.currency,
                    case when cv.buyer_id=$1 then sp.display_name else bp.display_name end as other_name,
                    case when cv.buyer_id=$1 then cv.seller_id else cv.buyer_id end as other_id,
                    case when cv.buyer_id=$1 then sp.avatar_url else bp.avatar_url end as other_avatar,
                    (select content from messages m where m.conversation_id=cv.id order by created_at desc limit 1) as last_content,
                    (select sender_id from messages m where m.conversation_id=cv.id order by created_at desc limit 1) as last_sender_id,
                    (select count(*)::int from messages m where m.conversation_id=cv.id and m.sender_id<>$1 and m.read_at is null) as unread
             from conversations cv left join listings l on l.id=cv.listing_id
             left join profiles bp on bp.user_id=cv.buyer_id left join profiles sp on sp.user_id=cv.seller_id
             where cv.buyer_id=$1 or cv.seller_id=$1 order by cv.updated_at desc`,
            [userId],
          );
          const conversations = rows.map((r) => ({
            id: String(r.id), listing_id: r.listing_id ? String(r.listing_id) : "",
            listing_title: r.listing_title ? String(r.listing_title) : "İlan kaldırıldı",
            listing_slug: r.listing_slug ? String(r.listing_slug) : "",
            listing_image: r.images ? (asJson<string[]>(r.images, [])[0] ?? null) : null,
            listing_price: r.price == null ? 0 : num(r.price), currency: String(r.currency ?? "TRY"),
            other_user_name: String(r.other_name ?? "Üye"), other_user_id: String(r.other_id),
            other_avatar: r.other_avatar ? String(r.other_avatar) : null,
            last_message: r.last_content == null ? "" : String(r.last_content) === LISTING_PHOTO_MSG ? "İlan görseli" : String(r.last_content),
            last_sender_id: r.last_sender_id ? String(r.last_sender_id) : "", unread_count: num(r.unread),
            updated_at: asIso(r.updated_at),
          }));
          return Response.json({ success: true, conversations }, { headers: { "Cache-Control": "private, no-store" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Konuşmalar yüklenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Mesaj göndermek için giriş yapın." }, { status: 401 });
          const body = await request.json() as { listingId?: unknown; content?: unknown };
          if (typeof body.listingId !== "string" || typeof body.content !== "string" || !body.content.trim() || body.content.length > 2000) {
            return Response.json({ success: false, error: "Mesajı kontrol edin." }, { status: 400 });
          }
          rateLimit(`msg:${userId}`, 40, 60_000);
          const sql = await getSql();
          await ensureProfile(userId);
          const listing = await sql.query<{ id: string; user_id: string; title: string; slug: string }>(
            "select id,user_id,title,slug from listings where id=$1 and status='ACTIVE' and (expires_at is null or expires_at>now())",
            [body.listingId],
          );
          if (!listing[0]) return Response.json({ success: false, error: "İlan bulunamadı." }, { status: 404 });
          if (listing[0].user_id === userId) return Response.json({ success: false, error: "Kendi ilanınıza mesaj gönderemezsiniz." }, { status: 400 });
          if (await hasUserBlock(sql, userId, listing[0].user_id)) return Response.json({ success: false, error: "Bu kullanıcıyla mesajlaşamazsınız." }, { status: 403 });
          const conversationId = await createOrGetConversation(sql, body.listingId, userId, listing[0].user_id, newId("cnv"));
          const messageId = newId("msg");
          const inserted = await insertConversationMessage(sql, messageId, conversationId, userId, body.content.trim()) as { id: string; sender_id: string; content: string; created_at: string; read_at: string | null };
          const msg = { ...inserted, created_at: asIso(inserted.created_at) };
          broadcastChatMessage(conversationId, msg);
          broadcastUserInbox(listing[0].user_id, { type: "new_message", conversationId, message: msg });
          broadcastUserInbox(userId, { type: "inbox_ping", conversationId });
          await notify(listing[0].user_id, "message", "Yeni mesaj", body.content.trim().slice(0, 80), `/mesajlar/${conversationId}`);
          return Response.json({ success: true, conversationId, message: msg });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Mesaj gönderilemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
