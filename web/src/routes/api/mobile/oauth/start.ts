import { createFileRoute } from "@tanstack/react-router";
import { auth, googleAuthConfigured } from "@/lib/auth/server";
import { isChallenge } from "@/lib/server/mobile-oauth";

export const Route = createFileRoute("/api/mobile/oauth/start")({
  server: {
    handlers: {
      /** Opened in the app's auth browser: starts Google sign-in and sets the OAuth state cookie there. */
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const challenge = url.searchParams.get("challenge");
        if (!googleAuthConfigured) return text("Google ile giriş şu an kullanılamıyor.", 503);
        if (!isChallenge(challenge)) return text("Geçersiz istek.", 400);
        const callbackURL = `${url.origin}/api/mobile/oauth/done?challenge=${challenge}`;
        const response = await auth.api.signInSocial({
          body: { provider: "google", callbackURL, errorCallbackURL: `${url.origin}/api/mobile/oauth/done?error=1` },
          headers: request.headers,
          asResponse: true,
        });
        const body = (await response.json().catch(() => null)) as { url?: string } | null;
        if (!response.ok || !body?.url) return text("Google ile giriş başlatılamadı.", 502);
        const headers = new Headers({ Location: body.url, "Cache-Control": "no-store" });
        for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
        return new Response(null, { status: 302, headers });
      },
    },
  },
});

function text(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
