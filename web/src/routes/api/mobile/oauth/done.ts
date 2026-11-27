import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { rateLimit, viewerKey } from "@/lib/server/helpers";
import { clearChallengeCookie, isChallenge, isSecureRequest, MOBILE_OAUTH_REDIRECT, parkToken, readChallengeCookie } from "@/lib/server/mobile-oauth";

export const Route = createFileRoute("/api/mobile/oauth/done")({
  server: {
    handlers: {
      /** Google sent the browser back with a session cookie: hand the app a one-time code. */
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const challenge = url.searchParams.get("challenge");
        const secure = isSecureRequest(request);
        const back = (query: string) =>
          new Response(null, {
            status: 302,
            headers: {
              Location: `${MOBILE_OAUTH_REDIRECT}?${query}`,
              "Cache-Control": "private, no-store",
              "Set-Cookie": clearChallengeCookie(secure),
            },
          });
        try {
          rateLimit(`mobile-oauth-done:${viewerKey(request.headers)}`, 30, 10 * 60_000);
        } catch {
          return back("error=1");
        }
        if (url.searchParams.get("error") || !isChallenge(challenge)) return back("error=1");
        // Only the flow this browser started: otherwise any app could open this
        // address directly and get a code for a session the browser already has.
        const cookieVal = readChallengeCookie(request.headers.get("cookie"));
        if (!cookieVal) return back("error=1");
        const a = Buffer.from(cookieVal);
        const b = Buffer.from(challenge);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return back("error=1");
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session?.session.token) return back("error=1");
        return back(`code=${encodeURIComponent(parkToken(challenge, session.session.token))}`);
      },
    },
  },
});
