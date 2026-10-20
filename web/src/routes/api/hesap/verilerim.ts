import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";
import { rateLimit } from "@/lib/server/helpers";
import { publicErrorMessage } from "@/lib/server/errors";

/**
 * KVKK data access: everything GeldeSat stores about the signed-in user, as one
 * JSON download. Secrets (password hashes, session tokens) and other people's
 * private data (their profiles, phone numbers) are left out; message threads
 * include the other side's messages because they are part of the user's chats.
 */
export const Route = createFileRoute("/api/hesap/verilerim")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (request.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
        const user = await getSessionUser();
        if (!user) return Response.json({ error: "Giriş yapmalısınız" }, { status: 401 });
        try {
          rateLimit(`export:${user.id}`, 5, 60 * 60_000);
          const sql = await getSql();
          const id = user.id;
          const q = (text: string) => sql.query<Record<string, unknown>>(text, [id]);
          const [account, logins, profile, store, listings, priceHistory, favorites, recentlyViewed, conversations, messages, reviewsGiven, reviewsReceived, reports, notifications, blocks, sessions] =
            await Promise.all([
              q(`select id, name, email, "emailVerified" as email_verified, "createdAt" as created_at from "user" where id=$1`),
              q(`select "providerId" as provider, "createdAt" as created_at from "account" where "userId"=$1`),
              q(`select user_id, display_name, phone, bio, city, district, avatar_url, role, phone_visibility, show_whatsapp, notify_prefs, created_at
                 from profiles where user_id=$1`),
              q(`select id, name, slug, description, city, phone, plan, created_at from stores where user_id=$1`),
              q(`select id, listing_no, slug, category_id, title, description, price, currency, status, city, district, neighborhood,
                        images, attrs, phone_override, view_count, created_at, updated_at, expires_at
                 from listings where user_id=$1 order by created_at`),
              q(`select h.listing_id, h.price, h.recorded_at from price_history h join listings l on l.id=h.listing_id
                 where l.user_id=$1 order by h.recorded_at`),
              q(`select f.listing_id, l.title, f.created_at from favorites f left join listings l on l.id=f.listing_id where f.user_id=$1`),
              q(`select v.listing_id, l.title, v.viewed_at from listing_views v left join listings l on l.id=v.listing_id where v.user_id=$1 order by v.viewed_at desc`),
              q(`select c.id, c.listing_id, l.title as listing_title, case when c.buyer_id=$1 then 'alıcı' else 'satıcı' end as role, c.updated_at
                 from conversations c left join listings l on l.id=c.listing_id where c.buyer_id=$1 or c.seller_id=$1`),
              q(`select m.conversation_id, case when m.sender_id=$1 then 'ben' else 'karşı taraf' end as sender, m.content, m.created_at, m.read_at
                 from messages m join conversations c on c.id=m.conversation_id
                 where c.buyer_id=$1 or c.seller_id=$1 order by m.created_at`),
              q(`select seller_id, listing_id, rating, comment, created_at from reviews where reviewer_id=$1`),
              q(`select listing_id, rating, comment, created_at from reviews where seller_id=$1`),
              q(`select listing_id, reason, details, status, created_at from reports where reporter_id=$1`),
              q(`select type, title, body, link, read_at, created_at from notifications where user_id=$1 order by created_at`),
              q(`select blocked_id, created_at from user_blocks where blocker_id=$1`),
              q(`select "createdAt" as created_at, "updatedAt" as last_active, "userAgent" as user_agent, "ipAddress" as ip_address
                 from "session" where "userId"=$1`),
            ]);
          const body = JSON.stringify(
            {
              exported_at: new Date().toISOString(),
              note: "GeldeSat hesabınıza ait kayıtlı veriler (KVKK md. 11). Şifreniz ve oturum anahtarlarınız güvenlik nedeniyle dahil edilmemiştir.",
              account: account[0] ?? null,
              sign_in_methods: logins,
              profile: profile[0] ?? null,
              store: store[0] ?? null,
              listings,
              price_history: priceHistory,
              favorites,
              recently_viewed: recentlyViewed,
              conversations,
              messages,
              reviews_given: reviewsGiven,
              reviews_received: reviewsReceived,
              reports,
              notifications,
              blocked_users: blocks,
              sessions,
            },
            null,
            2,
          );
          const date = new Date().toISOString().slice(0, 10);
          return new Response(body, {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Content-Disposition": `attachment; filename="geldesat-verilerim-${date}.json"`,
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (err) {
          return Response.json({ error: publicErrorMessage(err, "Veriler hazırlanamadı") }, { status: 400 });
        }
      },
    },
  },
});
