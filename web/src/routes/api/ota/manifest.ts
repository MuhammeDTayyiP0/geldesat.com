import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import {
  CHANNEL_PATTERN,
  RUNTIME_PATTERN,
  buildManifest,
  multipartResponse,
  pickUpdate,
  publicOrigin,
  rollbackDirective,
  type OtaPlatform,
  type OtaUpdateRow,
} from "@/lib/server/ota";

async function candidateUpdates(runtimeVersion: string, platform: OtaPlatform, channel: string): Promise<OtaUpdateRow[]> {
  const sql = await getSql();
  return sql.query<OtaUpdateRow>(
    `select id, group_id, runtime_version, platform, channel, kind, launch_asset, assets, expo_client,
            message, rollout, critical, created_at
       from ota_updates
      where runtime_version = $1 and platform = $2 and channel = $3
      order by created_at desc
      limit 30`,
    [runtimeVersion, platform, channel],
  );
}

/**
 * Expo Updates manifest endpoint (app.json → updates.url). expo-updates calls
 * it on every launch; see src/lib/server/ota.ts.
 */
export const Route = createFileRoute("/api/ota/manifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const header = (name: string) => request.headers.get(name) ?? url.searchParams.get(name);
        const protocolVersion = Number(header("expo-protocol-version") ?? 0) === 1 ? 1 : 0;
        const platform = header("expo-platform");
        const runtimeVersion = header("expo-runtime-version") ?? "";
        const channel = (header("expo-channel-name") ?? "production").toLowerCase();
        // iOS sends UUIDs in upper case; Postgres returns them in lower case.
        const currentId = header("expo-current-update-id")?.toLowerCase() ?? null;
        const embeddedId = header("expo-embedded-update-id")?.toLowerCase() ?? null;
        const clientId = header("eas-client-id")?.slice(0, 80) || null;

        if (platform !== "ios" && platform !== "android") return Response.json({ error: "expo-platform ios ya da android olmalı" }, { status: 400 });
        if (!RUNTIME_PATTERN.test(runtimeVersion)) return Response.json({ error: "Geçersiz expo-runtime-version" }, { status: 400 });
        if (!CHANNEL_PATTERN.test(channel)) return Response.json({ error: "Geçersiz expo-channel-name" }, { status: 400 });

        try {
          const rows = await candidateUpdates(runtimeVersion, platform as OtaPlatform, channel);
          const picked = pickUpdate(rows, clientId);
          // Protocol 0 clients cannot receive directives: "nothing new" is a 404 for them.
          const nothing = () => (protocolVersion === 1 ? multipartResponse([{ name: "directive", body: { type: "noUpdateAvailable" } }], 1) : new Response(null, { status: 404 }));

          if (!picked) return nothing();

          // Already running something newer than what this device may get (it
          // took part in a rollout that was later paused): keep what it has.
          const running = currentId ? rows.find((r) => r.id === currentId) : undefined;
          if (running && new Date(running.created_at) > new Date(picked.created_at)) return nothing();

          if (picked.kind === "rollback") {
            if (protocolVersion !== 1) return new Response(null, { status: 404 });
            // Already on the built-in code.
            if (!currentId || (embeddedId && currentId === embeddedId)) return nothing();
            return multipartResponse([{ name: "directive", body: rollbackDirective(picked) }], 1);
          }

          if (protocolVersion === 1 && currentId === picked.id) return nothing();

          return multipartResponse(
            [
              { name: "manifest", body: buildManifest(picked, publicOrigin(request)) },
              { name: "extensions", body: { assetRequestHeaders: {} } },
            ],
            protocolVersion,
          );
        } catch (err) {
          console.error("[ota] manifest failed:", err);
          return Response.json({ error: "Güncelleme bilgisi alınamadı" }, { status: 500 });
        }
      },
    },
  },
});
