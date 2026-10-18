import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { asJson } from "@/lib/utils";
import { NOTIFY_TYPES, resolveNotifyPrefs, type PhoneVisibility } from "@/lib/notification-prefs";
import { ensureProfile } from "./helpers";

/** Privacy and notification settings for the signed-in user. */
export const getAccountSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    const rows = await sql.query<{ phone_visibility: string; show_whatsapp: boolean; notify_prefs: unknown; push_devices: number }>(
      `select p.phone_visibility, p.show_whatsapp, p.notify_prefs,
              (select count(*)::int from mobile_push_tokens t where t.user_id = p.user_id) as push_devices
       from profiles p where p.user_id = $1`,
      [context.userId],
    );
    const r = rows[0];
    return {
      phone_visibility: (r?.phone_visibility ?? "members") as PhoneVisibility,
      show_whatsapp: r?.show_whatsapp ?? true,
      notify_prefs: resolveNotifyPrefs(asJson(r?.notify_prefs, {})),
      /** Push only reaches the mobile app; the page says so when no device is registered. */
      push_devices: r?.push_devices ?? 0,
    };
  });

export const updatePrivacySettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ phone_visibility: z.enum(["everyone", "members", "hidden"]), show_whatsapp: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    await sql.query("update profiles set phone_visibility=$2, show_whatsapp=$3 where user_id=$1", [
      context.userId,
      data.phone_visibility,
      data.show_whatsapp,
    ]);
    return { ok: true };
  });

const channel = z.object({ inapp: z.boolean(), push: z.boolean() });
const prefsSchema = z.object(Object.fromEntries(NOTIFY_TYPES.map(({ type }) => [type, channel])) as Record<(typeof NOTIFY_TYPES)[number]["type"], typeof channel>);

export const updateNotifyPrefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(prefsSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    // Resolve again so locked channels (listing status in-app) can't be switched off.
    const prefs = resolveNotifyPrefs(data);
    await sql.query("update profiles set notify_prefs=$2::jsonb where user_id=$1", [context.userId, JSON.stringify(prefs)]);
    return { ok: true, prefs };
  });
