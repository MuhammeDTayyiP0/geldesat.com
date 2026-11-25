import { createFileRoute } from "@tanstack/react-router";

const APPLINK_PATHS = [
  "/ilan/*",
  "/satici/*",
  "/magaza/*",
  "/category/*",
  "/search",
  "/harita",
  "/karsilastir",
  "/mesajlar/*",
  "/mesajlar",
  "/favoriler",
  "/bildirimler",
  "/ilanlarim",
  "/ayarlar/*",
  "/sayfa/*",
];

export const Route = createFileRoute("/.well-known/apple-app-site-association")({
  server: {
    handlers: {
      GET: async () => {
        const teamId = process.env.APPLE_TEAM_ID?.trim();
        const bundleId = process.env.IOS_BUNDLE_ID?.trim() || "com.geldesat.app";

        if (!teamId) {
          return Response.json(
            {
              applinks: { apps: [], details: [] },
              webcredentials: { apps: [] },
            },
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=300",
              },
            },
          );
        }

        const appId = `${teamId}.${bundleId}`;
        return Response.json(
          {
            applinks: {
              details: [
                {
                  appIDs: [appId],
                  components: APPLINK_PATHS.map((path) => ({ "/": path })),
                },
              ],
            },
            webcredentials: {
              apps: [appId],
            },
          },
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300",
            },
          },
        );
      },
    },
  },
});
