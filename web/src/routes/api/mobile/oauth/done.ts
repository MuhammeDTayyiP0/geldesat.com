import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { isChallenge, MOBILE_OAUTH_REDIRECT, parkToken } from "@/lib/server/mobile-oauth";

export const Route = createFileRoute("/api/mobile/oauth/done")({
  server: {
    handlers: {
      /** Google sent the browser back with a session cookie: hand the app a one-time code. */
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const challenge = url.searchParams.get("challenge");
        const back = (query: string) =>
          new Response(null, { status: 302, headers: { Location: `${MOBILE_OAUTH_REDIRECT}?${query}`, "Cache-Control": "no-store" } });
        if (url.searchParams.get("error") || !isChallenge(challenge)) return back("error=1");
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session?.session.token) return back("error=1");
        return back(`code=${encodeURIComponent(parkToken(challenge, session.session.token))}`);
      },
    },
  },
});
