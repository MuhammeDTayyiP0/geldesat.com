import { createFileRoute } from "@tanstack/react-router";
import { getAppConfig, calculateVariant } from "@/lib/server/config";

export const Route = createFileRoute("/api/mobile/config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const userId = url.searchParams.get("userId") || url.searchParams.get("deviceId") || "guest";

          const [sections, features, mobileApp] = await Promise.all([
            getAppConfig<string[]>("home_sections", ["hero", "categories", "featured", "recent", "stats"]),
            getAppConfig<Record<string, boolean>>("features", {
              ab_testing: true,
              doping_enabled: true,
              mobile_bottom_nav: true,
            }),
            getAppConfig("mobile_app", {
              min_ios_version: "1.0.0",
              min_android_version: "1.0.0",
              announcement: null,
            }),
          ]);

          // Yerel A/B Testi Varyant Hesaplaması (0 TL, harici servis yok)
          const listingCardVariant = calculateVariant("listing_card_layout", userId, ["grid", "list"]);

          return new Response(
            JSON.stringify({
              success: true,
              homeSections: sections,
              features,
              mobileApp,
              abTests: {
                listing_card_layout: listingCardVariant,
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=60",
              },
            },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Konfigürasyon getirilemedi";
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
