import { createFileRoute } from "@tanstack/react-router";
import { getAppConfig, resolveFlags } from "@/lib/server/config";
import { publicErrorMessage } from "@/lib/server/errors";
import { googleAuthConfigured } from "@/lib/auth/server";
import { getMobileUserId } from "@/lib/server/mobile-auth";
import { VERSION_PATTERN, type FlagPlatform } from "@/lib/flags";

/** Builds before 1.1 send no `platform`; their HTTP client gives it away. */
function platformOf(url: URL, request: Request): FlagPlatform {
  const p = url.searchParams.get("platform");
  if (p === "ios" || p === "android") return p;
  const ua = request.headers.get("user-agent") ?? "";
  return /darwin|cfnetwork|iphone|ipad/i.test(ua) ? "ios" : "android";
}

export const Route = createFileRoute("/api/mobile/config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const deviceId = url.searchParams.get("deviceId")?.slice(0, 80) || null;
          const appVersion = url.searchParams.get("appVersion");
          const userId = await getMobileUserId(request).catch(() => null);

          const [sections, features, mobileApp] = await Promise.all([
            getAppConfig<string[]>("home_sections", ["hero", "categories", "featured", "recent", "stats"]),
            resolveFlags({
              userId,
              anonId: deviceId,
              platform: platformOf(url, request),
              appVersion: appVersion && VERSION_PATTERN.test(appVersion) ? appVersion : null,
            }),
            getAppConfig("mobile_app", {
              min_ios_version: "1.0.0",
              min_android_version: "1.0.0",
              announcement: null,
            }),
          ]);

          return new Response(
            JSON.stringify({
              success: true,
              homeSections: sections,
              features,
              mobileApp,
              auth: { google: googleAuthConfigured },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                // Flags differ per person, so no shared caches.
                "Cache-Control": "private, no-store",
              },
            },
          );
        } catch (err) {
          const msg = publicErrorMessage(err, "Konfigürasyon getirilemedi");
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      },
    },
  },
});
