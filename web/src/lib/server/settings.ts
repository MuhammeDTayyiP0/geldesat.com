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
    const rows = await sql.query<{ phone_visibility: string; show_whatsapp: boolean; read_receipts: boolean; notify_prefs: unknown; push_devices: number }>(
      `select p.phone_visibility, p.show_whatsapp, p.read_receipts, p.notify_prefs,
              (select count(*)::int from mobile_push_tokens t where t.user_id = p.user_id) as push_devices
       from profiles p where p.user_id = $1`,
      [context.userId],
    );
    const r = rows[0];
    return {
      phone_visibility: (r?.phone_visibility ?? "members") as PhoneVisibility,
      show_whatsapp: r?.show_whatsapp ?? true,
      read_receipts: r?.read_receipts ?? true,
      notify_prefs: resolveNotifyPrefs(asJson(r?.notify_prefs, {})),
      /** Push only reaches the mobile app; the page says so when no device is registered. */
      push_devices: r?.push_devices ?? 0,
    };
  });

export const updatePrivacySettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ phone_visibility: z.enum(["everyone", "members", "hidden"]), show_whatsapp: z.boolean(), read_receipts: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    await sql.query("update profiles set phone_visibility=$2, show_whatsapp=$3, read_receipts=$4 where user_id=$1", [
      context.userId,
      data.phone_visibility,
      data.show_whatsapp,
      data.read_receipts,
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

/** Deletion state of the signed-in account: when it will be purged, or null. */
export const getDeletionStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sweepRetention } = await import("./retention");
    void sweepRetention().catch((err) => console.warn("[retention] sweep failed", err));
    const sql = await getSql();
    const rows = await sql.query<{ until: string | null }>(
      "select (deletion_requested_at + interval '30 days')::text as until from profiles where user_id=$1",
      [context.userId],
    );
    return { purgeAt: rows[0]?.until ?? null };
  });

/**
 * Ask to delete the account. Password accounts confirm with the password;
 * Google-only accounts need a sign-in from the last 24 hours. Starts the
 * 30-day grace period (listings hidden, sessions ended).
 */
export const requestMyAccountDeletion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ password: z.string().max(200).optional() }))
  .handler(async ({ context, data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth/server");
    const { requestAccountDeletion } = await import("./retention");
    const sql = await getSql();
    const profile = await ensureProfile(context.userId);
    if (profile.role === "ADMIN") throw new Error("Yönetici hesapları silinemez. Önce yönetici rolünü kaldırın.");

    const headers = getRequest()?.headers ?? new Headers();
    const credential = await sql.query<{ n: number }>(
      `select 1 as n from "account" where "userId"=$1 and "providerId"='credential' limit 1`,
      [context.userId],
    );
    if (credential[0]) {
      if (!data.password) throw new Error("Şifrenizi girin.");
      try {
        await auth.api.verifyPassword({ body: { password: data.password }, headers });
      } catch {
        throw new Error("Şifre hatalı.");
      }
    } else {
      const session = await auth.api.getSession({ headers });
      const signedInAt = session ? new Date(session.session.createdAt).getTime() : 0;
      if (Date.now() - signedInAt > 24 * 60 * 60_000) {
        throw new Error("Güvenliğiniz için çıkış yapıp tekrar giriş yaptıktan sonra deneyin.");
      }
    }
    return { purgeAt: await requestAccountDeletion(context.userId) };
  });

/** Cancel a pending deletion (only possible while signed in during the grace period). */
export const restoreMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { restoreAccount } = await import("./retention");
    await restoreAccount(context.userId);
    return { ok: true };
  });
