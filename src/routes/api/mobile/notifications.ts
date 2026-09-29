import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getMobileUserId } from "@/lib/server/mobile-auth";

export const Route = createFileRoute("/api/mobile/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const sql = await getSql();
          const [rows, count] = await Promise.all([
            sql.query<Record<string, unknown>>("select id,type,title,body,link,read_at,created_at from notifications where user_id=$1 order by created_at desc limit 50", [userId]),
            sql.query<{ n: number }>("select count(*)::int as n from notifications where user_id=$1 and read_at is null", [userId]),
          ]);
          const notifications = rows.map((n) => ({ id: String(n.id), type: String(n.type), title: String(n.title), body: String(n.body ?? ""), link: String(n.link ?? "/"), read: Boolean(n.read_at), created_at: new Date(String(n.created_at)).toISOString() }));
          return Response.json({ success: true, notifications, unread: count[0]?.n ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Bildirimler yüklenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const sql = await getSql();
          const body = await request.json().catch(() => ({})) as { action?: unknown; token?: unknown; platform?: unknown };
          if (body.action === "register-push") {
            if (typeof body.token !== "string" || body.token.length > 512 || !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(body.token)) {
              return Response.json({ success: false, error: "Push token geçersiz." }, { status: 400 });
            }
            if (body.platform !== "ios" && body.platform !== "android") {
              return Response.json({ success: false, error: "Cihaz türü geçersiz." }, { status: 400 });
            }
            await sql.query(
              `insert into mobile_push_tokens (token,user_id,platform) values ($1,$2,$3)
               on conflict (token) do update set user_id=excluded.user_id, platform=excluded.platform, updated_at=now()`,
              [body.token, userId, body.platform],
            );
            return Response.json({ success: true });
          }
          if (body.action === "unregister-push") {
            if (typeof body.token !== "string") return Response.json({ success: false, error: "Push token geçersiz." }, { status: 400 });
            await sql.query("delete from mobile_push_tokens where token=$1 and user_id=$2", [body.token, userId]);
            return Response.json({ success: true });
          }
          await sql.query("update notifications set read_at=now() where user_id=$1 and read_at is null", [userId]);
          return Response.json({ success: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Bildirimler güncellenemedi.";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
