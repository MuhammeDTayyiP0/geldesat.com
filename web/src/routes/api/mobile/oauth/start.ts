import { createFileRoute } from "@tanstack/react-router";
import { auth, googleAuthConfigured } from "@/lib/auth/server";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";
import { rateLimit, viewerKey } from "@/lib/server/helpers";
import { challengeCookie, isChallenge, isSecureRequest } from "@/lib/server/mobile-oauth";
import { publicOrigin } from "@/lib/server/ota";

export const Route = createFileRoute("/api/mobile/oauth/start")({
  server: {
    handlers: {
      /** Opened in the app's auth browser: starts Google sign-in and sets the OAuth state cookie there. */
      GET: async ({ request }) => {
        try {
          rateLimit(`mobile-oauth:${viewerKey(request.headers)}`, 30, 10 * 60_000);
          const url = new URL(request.url);
          const challenge = url.searchParams.get("challenge");
          if (!googleAuthConfigured) return text("Google ile giriş şu an kullanılamıyor.", 503);
          if (!isChallenge(challenge)) return text("Geçersiz istek.", 400);
          const origin = publicOrigin(request);
          const callbackURL = `${origin}/api/mobile/oauth/done?challenge=${challenge}`;
          const response = await auth.api.signInSocial({
            body: { provider: "google", callbackURL, errorCallbackURL: `${origin}/api/mobile/oauth/done?error=1` },
            headers: request.headers,
            asResponse: true,
          });
          const body = (await response.json().catch(() => null)) as { url?: string } | null;
          if (!response.ok || !body?.url) return text("Google ile giriş başlatılamadı.", 502);
          const headers = new Headers({ Location: body.url, "Cache-Control": "no-store" });
          for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
          headers.append("Set-Cookie", challengeCookie(challenge, isSecureRequest(request)));
          return new Response(null, { status: 302, headers });
        } catch (error) {
          return text(publicErrorMessage(error, "Google ile giriş başlatılamadı."), errorStatus(error, 500));
        }
      },
    },
  },
});

function text(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
