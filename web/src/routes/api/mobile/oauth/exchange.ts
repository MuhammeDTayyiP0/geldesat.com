import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { rateLimit, viewerKey } from "@/lib/server/helpers";
import { publicErrorMessage } from "@/lib/server/errors";
import { redeemCode } from "@/lib/server/mobile-oauth";

export const Route = createFileRoute("/api/mobile/oauth/exchange")({
  server: {
    handlers: {
      /** `{ code, verifier }` → the session token and user for the app. */
      POST: async ({ request }) => {
        try {
          rateLimit(`mobile-oauth:${viewerKey(request.headers)}`, 20, 60_000);
          const body = (await request.json().catch(() => ({}))) as { code?: unknown; verifier?: unknown };
          if (typeof body.code !== "string" || typeof body.verifier !== "string" || body.verifier.length < 43 || body.verifier.length > 128) {
            return Response.json({ success: false, error: "Giriş bilgisi geçersiz." }, { status: 400 });
          }
          const token = redeemCode(body.code, body.verifier);
          if (!token) return Response.json({ success: false, error: "Giriş süresi doldu. Lütfen tekrar deneyin." }, { status: 400 });
          const session = await auth.api.getSession({ headers: new Headers({ Authorization: `Bearer ${token}` }) });
          if (!session?.user) return Response.json({ success: false, error: "Oturum doğrulanamadı." }, { status: 401 });
          return Response.json({
            success: true,
            token,
            user: { id: session.user.id, email: session.user.email, name: session.user.name },
          });
        } catch (error) {
          return Response.json({ success: false, error: publicErrorMessage(error, "Giriş tamamlanamadı.") }, { status: 500 });
        }
      },
    },
  },
});
