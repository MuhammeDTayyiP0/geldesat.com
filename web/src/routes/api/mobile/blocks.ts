import { createFileRoute } from "@tanstack/react-router";
import { getMobileUserId } from "@/lib/server/mobile-auth";
import { getSql } from "@/lib/db";
import { publicErrorMessage } from "@/lib/server/errors";

export const Route = createFileRoute("/api/mobile/blocks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getMobileUserId(request);
          if (!userId) return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          const body = await request.json() as { userId?: unknown; blocked?: unknown };
          if (typeof body.userId !== "string" || !body.userId || body.userId === userId) return Response.json({ success: false, error: "Kullanıcı bilgisi geçersiz." }, { status: 400 });
          const sql = await getSql();
          if (body.blocked === false) await sql.query("delete from user_blocks where blocker_id=$1 and blocked_id=$2", [userId, body.userId]);
          else await sql.query("insert into user_blocks (blocker_id,blocked_id) values ($1,$2) on conflict (blocker_id,blocked_id) do nothing", [userId, body.userId]);
          return Response.json({ success: true, blocked: body.blocked !== false });
        } catch (error) {
          const message = publicErrorMessage(error, "Engelleme işlemi tamamlanamadı.");
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
