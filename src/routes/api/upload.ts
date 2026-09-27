import { createFileRoute } from "@tanstack/react-router";
import { saveImageToDisk } from "@/lib/server/upload.server";
import { getSessionUser } from "@/lib/auth/verify.server";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await getSessionUser();
          if (!user) {
            return new Response(JSON.stringify({ error: "Giriş yapmalısınız" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const body = (await request.json()) as { image?: string };
          if (!body.image) {
            return new Response(JSON.stringify({ error: "Görsel verisi eksik" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const url = await saveImageToDisk(body.image, user.id);
          return new Response(JSON.stringify({ success: true, url }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Yükleme başarısız";
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
