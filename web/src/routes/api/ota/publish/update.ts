import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { newId } from "@/lib/utils";
import { CHANNEL_PATTERN, HASH_PATTERN, RUNTIME_PATTERN, publishAuth, publishDenied } from "@/lib/server/ota";

const Asset = z.object({
  hash: z.string().regex(HASH_PATTERN),
  key: z.string().regex(/^[a-f0-9]{32}$/),
  contentType: z.string().min(1).max(100),
  fileExtension: z.string().regex(/^\.[A-Za-z0-9]{1,10}$/).optional(),
});

const PlatformBundle = z.object({ launchAsset: Asset, assets: z.array(Asset).max(2000) });

const Input = z.object({
  runtimeVersion: z.string().regex(RUNTIME_PATTERN),
  channel: z.string().regex(CHANNEL_PATTERN).default("production"),
  message: z.string().trim().max(300).default(""),
  rollout: z.number().int().min(0).max(100).default(100),
  critical: z.boolean().default(false),
  expoClient: z.record(z.string(), z.unknown()).default({}),
  platforms: z
    .object({ ios: PlatformBundle.optional(), android: PlatformBundle.optional() })
    .refine((p) => p.ios || p.android, "En az bir platform gerekli"),
});

/** Final step of `mobile-app/scripts/ota-publish.mjs`: records the update once its files are uploaded. */
export const Route = createFileRoute("/api/ota/publish/update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = publishAuth(request);
        if (auth !== "ok") return publishDenied(auth);
        const parsed = Input.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ success: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
        const data = parsed.data;

        const sql = await getSql();
        const bundles = Object.entries(data.platforms).filter((e): e is ["ios" | "android", z.infer<typeof PlatformBundle>] => Boolean(e[1]));
        const hashes = [...new Set(bundles.flatMap(([, b]) => [b.launchAsset.hash, ...b.assets.map((a) => a.hash)]))];
        const found = await sql.query<{ hash: string }>("select hash from ota_assets where hash = any($1::text[])", [hashes]);
        if (found.length !== hashes.length) {
          return Response.json({ success: false, error: `${hashes.length - found.length} dosya sunucuda yok; önce dosyaları yükleyin.` }, { status: 409 });
        }

        const groupId = newId("ota");
        const ids: Record<string, string> = {};
        await sql.transaction(async (tx) => {
          for (const [platform, bundle] of bundles) {
            const id = crypto.randomUUID();
            ids[platform] = id;
            await tx.query(
              `insert into ota_updates (id, group_id, runtime_version, platform, channel, kind, launch_asset, assets, expo_client, message, rollout, critical, created_by)
               values ($1, $2, $3, $4, $5, 'update', $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11, 'script')`,
              [id, groupId, data.runtimeVersion, platform, data.channel, JSON.stringify(bundle.launchAsset), JSON.stringify(bundle.assets), JSON.stringify(data.expoClient), data.message, data.rollout, data.critical],
            );
          }
        });
        return Response.json({ success: true, groupId, ids });
      },
    },
  },
});
