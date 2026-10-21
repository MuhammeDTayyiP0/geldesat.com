import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { newId } from "@/lib/utils";
import { CHANNEL_PATTERN, RUNTIME_PATTERN } from "../ota";
import { adminMiddleware, audit } from "./common";

/** One published update as the admin panel shows it (its iOS and Android rows together). */
export type AdminOtaUpdate = {
  groupId: string;
  kind: "update" | "rollback";
  runtimeVersion: string;
  channel: string;
  platforms: Array<"ios" | "android">;
  message: string;
  rollout: number;
  critical: boolean;
  createdAt: string;
  createdBy: string | null;
  republishedFrom: string | null;
  /** Total size of the files this update needs, in bytes. */
  bytes: number;
};

export const adminListOtaUpdates = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql.query<{
      group_id: string;
      kind: "update" | "rollback";
      runtime_version: string;
      channel: string;
      platforms: Array<"ios" | "android">;
      message: string;
      rollout: number;
      critical: boolean;
      created_at: string | Date;
      created_by: string | null;
      creator: string | null;
      republished_from: string | null;
      bytes: number | string | null;
    }>(
      `select u.group_id, min(u.kind) as kind, min(u.runtime_version) as runtime_version, min(u.channel) as channel,
              array_agg(u.platform order by u.platform) as platforms, min(u.message) as message,
              min(u.rollout)::int as rollout, bool_or(u.critical) as critical, min(u.created_at) as created_at,
              min(u.created_by) as created_by, min(p.display_name) as creator, min(u.republished_from) as republished_from,
              (select coalesce(sum(octet_length(a.data)), 0) from ota_assets a
                where a.hash in (
                  select x.launch_asset->>'hash' from ota_updates x where x.group_id = u.group_id
                  union
                  select e->>'hash' from ota_updates x, jsonb_array_elements(x.assets) e where x.group_id = u.group_id
                )) as bytes
         from ota_updates u
         left join profiles p on p.user_id = u.created_by
        group by u.group_id
        order by min(u.created_at) desc
        limit 100`,
    );
    const updates: AdminOtaUpdate[] = rows.map((r) => ({
      groupId: r.group_id,
      kind: r.kind,
      runtimeVersion: r.runtime_version,
      channel: r.channel,
      platforms: r.platforms,
      message: r.message,
      rollout: Number(r.rollout),
      critical: r.critical,
      createdAt: new Date(r.created_at).toISOString(),
      createdBy: r.created_by === "script" ? "Yayın scripti" : (r.creator ?? r.created_by),
      republishedFrom: r.republished_from,
      bytes: Number(r.bytes ?? 0),
    }));
    return {
      updates,
      publishingEnabled: (process.env.OTA_PUBLISH_TOKEN?.trim().length ?? 0) >= 24,
    };
  });

export const adminSetOtaRollout = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ groupId: z.string().min(1).max(60), rollout: z.number().int().min(0).max(100) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>("update ota_updates set rollout = $2 where group_id = $1 and kind = 'update' returning id", [data.groupId, data.rollout]);
    if (!rows.length) throw new Error("Güncelleme bulunamadı.");
    await audit(sql, context.adminId, "ota.rollout", "system", data.groupId, `Uygulama güncellemesi yayılımı %${data.rollout} yapıldı`, { rollout: data.rollout });
    return { ok: true as const };
  });

/**
 * Roll back to an older update. Phones always keep the newest update they have,
 * so "go back" means publishing a fresh copy of the old one (same files, new id).
 */
export const adminRepublishOta = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ groupId: z.string().min(1).max(60) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const groupId = newId("ota");
    const copied = await sql.query<{ id: string; message: string }>(
      `insert into ota_updates (id, group_id, runtime_version, platform, channel, kind, launch_asset, assets, expo_client, message, rollout, critical, republished_from, created_by)
       select gen_random_uuid(), $2, runtime_version, platform, channel, kind, launch_asset, assets, expo_client,
              left('Geri dönüş: ' || message, 300), 100, critical, group_id, $3
         from ota_updates where group_id = $1 and kind = 'update'
       returning id, message`,
      [data.groupId, groupId, context.adminId],
    );
    if (!copied.length) throw new Error("Güncelleme bulunamadı.");
    await audit(sql, context.adminId, "ota.republish", "system", groupId, "Eski bir uygulama güncellemesine geri dönüldü", { from: data.groupId });
    return { ok: true as const, groupId };
  });

/** Send every phone on this runtime and channel back to the code built into the store app. */
export const adminRollbackOtaToEmbedded = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      runtimeVersion: z.string().regex(RUNTIME_PATTERN),
      channel: z.string().regex(CHANNEL_PATTERN),
      platforms: z.array(z.enum(["ios", "android"])).min(1).max(2),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const groupId = newId("ota");
    await sql.transaction(async (tx) => {
      for (const platform of new Set(data.platforms)) {
        await tx.query(
          `insert into ota_updates (id, group_id, runtime_version, platform, channel, kind, message, rollout, created_by)
           values (gen_random_uuid(), $1, $2, $3, $4, 'rollback', 'Mağaza sürümüne dönüş', 100, $5)`,
          [groupId, data.runtimeVersion, platform, data.channel, context.adminId],
        );
      }
    });
    await audit(sql, context.adminId, "ota.rollback", "system", groupId, `Uygulama ${data.runtimeVersion} (${data.channel}) mağaza sürümüne döndürüldü`, data);
    return { ok: true as const, groupId };
  });
