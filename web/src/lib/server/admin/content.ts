import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, dbSource } from "@/lib/db";
import { newId, num, slugify } from "@/lib/utils";
import { normalizeTrPhone } from "../helpers";
import { getAppConfig, setAppConfig } from "../config";
import { clearSiteSettingsCache, loadSiteSettings } from "../catalog";
import { mailConfigured } from "../mail";
import { adminMiddleware, audit, likeTerm, paged, paging, PageInput, ts, Where } from "./common";
import { mapAudit } from "./dashboard";

/* ───────────────────────────── Pages ───────────────────────────── */

export const adminListPages = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql.query<{ slug: string; title: string; body: string }>("select slug, title, body from legal_pages order by title");
    return rows.map((r) => ({ slug: r.slug, title: r.title, body: r.body, length: r.body.length }));
  });

export const adminSavePage = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      originalSlug: z.string().max(80).optional(),
      slug: z.string().trim().min(1).max(80),
      title: z.string().trim().min(2).max(120),
      body: z.string().trim().min(10).max(100_000),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const slug = slugify(data.slug);
    if (!slug) throw new Error("Geçerli bir sayfa adresi girin.");
    if (slug !== data.originalSlug) {
      const taken = await sql.query("select 1 from legal_pages where slug = $1", [slug]);
      if (taken.length) throw new Error("Bu adreste başka bir sayfa var.");
    }
    if (data.originalSlug) {
      const rows = await sql.query<{ slug: string }>("update legal_pages set slug = $2, title = $3, body = $4 where slug = $1 returning slug", [
        data.originalSlug,
        slug,
        data.title,
        data.body,
      ]);
      if (!rows[0]) throw new Error("Sayfa bulunamadı.");
    } else {
      await sql.query("insert into legal_pages (slug, title, body) values ($1,$2,$3)", [slug, data.title, data.body]);
    }
    await audit(sql, context.adminId, data.originalSlug ? "page.edit" : "page.create", "page", slug, `Sayfa "${data.title}" ${data.originalSlug ? "güncellendi" : "oluşturuldu"}`);
    return { ok: true as const, slug };
  });

export const adminDeletePage = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ slug: z.string().max(80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ title: string }>("delete from legal_pages where slug = $1 returning title", [data.slug]);
    if (!rows[0]) throw new Error("Sayfa bulunamadı.");
    await audit(sql, context.adminId, "page.delete", "page", data.slug, `Sayfa "${rows[0].title}" silindi`);
    return { ok: true as const };
  });

/* ───────────────────────────── Broadcast ───────────────────────────── */

const AUDIENCES = {
  all: "Tüm üyeler",
  active_30d: "Son 30 günde aktif üyeler",
  sellers: "İlanı olan üyeler",
  stores: "Mağaza sahipleri",
  admins: "Yöneticiler",
} as const;

const AUDIENCE_SQL: Record<keyof typeof AUDIENCES, string> = {
  all: "select user_id from profiles where banned_at is null and deletion_requested_at is null",
  active_30d: "select user_id from profiles where banned_at is null and deletion_requested_at is null and last_seen_at > now() - interval '30 days'",
  sellers: "select p.user_id from profiles p where p.banned_at is null and p.deletion_requested_at is null and exists (select 1 from listings l where l.user_id = p.user_id)",
  stores: "select p.user_id from profiles p join stores s on s.user_id = p.user_id where p.banned_at is null and p.deletion_requested_at is null",
  admins: "select user_id from profiles where role = 'ADMIN'",
};

export const adminAudienceSizes = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const out: Record<string, { label: string; count: number; devices: number }> = {};
    for (const [key, label] of Object.entries(AUDIENCES) as Array<[keyof typeof AUDIENCES, string]>) {
      const rows = await sql.query<{ n: number; d: number }>(
        `with a as (${AUDIENCE_SQL[key]})
         select (select count(*) from a) as n, (select count(*) from mobile_push_tokens t where t.user_id in (select user_id from a)) as d`,
      );
      out[key] = { label, count: num(rows[0]?.n), devices: num(rows[0]?.d) };
    }
    return out;
  });

/** In-app notification to a whole audience, optionally pushed to their phones. */
export const adminBroadcast = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      audience: z.enum(Object.keys(AUDIENCES) as [keyof typeof AUDIENCES, ...Array<keyof typeof AUDIENCES>]),
      title: z.string().trim().min(2).max(120),
      body: z.string().trim().min(2).max(1000),
      link: z.string().trim().max(300).optional(),
      push: z.boolean().default(false),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const link = data.link && data.link.startsWith("/") ? data.link : "/bildirimler";
    const inserted = await sql.query<{ user_id: string }>(
      `insert into notifications (id, user_id, type, title, body, link)
       select 'ntf_' || substr(md5(random()::text || a.user_id), 1, 12), a.user_id, 'system', $1, $2, $3
       from (${AUDIENCE_SQL[data.audience]}) a
       returning user_id`,
      [data.title, data.body, link],
    );
    let pushed = 0;
    if (data.push) {
      const tokens = await sql.query<{ token: string }>(
        `select t.token from mobile_push_tokens t where t.user_id in (${AUDIENCE_SQL[data.audience]})`,
      );
      // Expo accepts up to 100 messages per request; delivery is best effort.
      for (let i = 0; i < tokens.length; i += 100) {
        const batch = tokens.slice(i, i + 100);
        try {
          const res = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(batch.map(({ token }) => ({ to: token, title: data.title, body: data.body, sound: "default", data: { link }, channelId: "default" }))),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) pushed += batch.length;
        } catch (err) {
          console.warn("[broadcast] push batch failed", err instanceof Error ? err.message : err);
        }
      }
    }
    await audit(sql, context.adminId, "broadcast.send", "broadcast", newId("bc"), `"${data.title}" → ${AUDIENCES[data.audience]} (${inserted.length} üye${data.push ? `, ${pushed} cihaz` : ""})`, {
      audience: data.audience,
      title: data.title,
      body: data.body,
      link,
      recipients: inserted.length,
      pushed,
    });
    return { ok: true as const, recipients: inserted.length, pushed };
  });

/* ───────────────────────────── Settings ───────────────────────────── */

export type ModerationMode = "first_free" | "all" | "none";
export type MobileAppConfig = { min_ios_version: string; min_android_version: string; announcement: string | null };

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const [site, features, mobileApp, homeSections, moderation] = await Promise.all([
      loadSiteSettings(),
      getAppConfig<Record<string, boolean>>("features", { ab_testing: true, doping_enabled: true, mobile_bottom_nav: true }),
      getAppConfig<MobileAppConfig>("mobile_app", { min_ios_version: "1.0.0", min_android_version: "1.0.0", announcement: null }),
      getAppConfig<string[]>("home_sections", ["hero", "categories", "featured", "recent", "stats"]),
      getAppConfig<{ mode: ModerationMode }>("moderation", { mode: "first_free" }),
    ]);
    return { site, features, mobileApp, homeSections, moderation };
  });

export const adminSaveSiteSettings = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      company_name: z.string().trim().max(80),
      support_email: z.string().trim().max(120),
      support_phone: z.string().trim().max(20),
      bank_name: z.string().trim().max(80),
      account_holder: z.string().trim().max(80),
      iban: z.string().trim().max(40),
    }),
  )
  .handler(async ({ context, data }) => {
    const iban = data.iban.replace(/\s+/g, "").toUpperCase();
    if (iban && !/^TR\d{24}$/.test(iban)) throw new Error("IBAN TR ile başlamalı ve 26 karakter olmalı.");
    if (data.support_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.support_email)) throw new Error("Geçerli bir destek e-postası girin.");
    const phone = data.support_phone ? normalizeTrPhone(data.support_phone) : "";
    const sql = await getSql();
    const values: Array<[string, string]> = [
      ["company_name", data.company_name || "GeldeSat"],
      ["support_email", data.support_email || "destek@geldesat.com"],
      ["support_phone", phone],
      ["bank_name", data.bank_name],
      ["account_holder", data.account_holder],
      ["iban", iban],
    ];
    for (const [key, value] of values) {
      await sql.query("insert into site_settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value", [key, value]);
    }
    clearSiteSettingsCache();
    await audit(sql, context.adminId, "settings.site", "settings", "site", "Site ve iletişim bilgileri güncellendi");
    return { ok: true as const };
  });

const ConfigInput = z.discriminatedUnion("key", [
  z.object({ key: z.literal("features"), value: z.record(z.string().max(60), z.boolean()) }),
  z.object({
    key: z.literal("mobile_app"),
    value: z.object({
      min_ios_version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, "Sürüm 1.2.3 biçiminde olmalı"),
      min_android_version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, "Sürüm 1.2.3 biçiminde olmalı"),
      announcement: z.string().trim().max(300).nullable(),
    }),
  }),
  z.object({ key: z.literal("home_sections"), value: z.array(z.enum(["hero", "categories", "featured", "recent", "stats"])).max(10) }),
  z.object({ key: z.literal("moderation"), value: z.object({ mode: z.enum(["first_free", "all", "none"]) }) }),
]);

const CONFIG_LABEL = { features: "Özellik anahtarları", mobile_app: "Mobil uygulama ayarları", home_sections: "Ana sayfa bölümleri", moderation: "İlan onay politikası" };

export const adminSaveAppConfig = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(ConfigInput)
  .handler(async ({ context, data }) => {
    const value = data.key === "mobile_app" ? { ...data.value, announcement: data.value.announcement || null } : data.value;
    await setAppConfig(data.key, value);
    const sql = await getSql();
    await audit(sql, context.adminId, `settings.${data.key}`, "settings", data.key, `${CONFIG_LABEL[data.key]} güncellendi`, { value });
    return { ok: true as const };
  });

/* ───────────────────────────── Audit log ───────────────────────────── */

export const adminListAudit = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      q: z.string().trim().max(120).optional(),
      targetType: z.string().max(40).optional(),
      adminId: z.string().max(200).optional(),
      targetId: z.string().max(200).optional(),
      ...PageInput,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.targetType) w.add(`a.target_type = ${w.param(data.targetType)}`);
    if (data.adminId) w.add(`a.admin_id = ${w.param(data.adminId)}`);
    if (data.targetId) w.add(`a.target_id = ${w.param(data.targetId)}`);
    if (data.q) {
      const like = w.param(likeTerm(data.q));
      w.add(`(a.summary ilike ${like} or a.action ilike ${like})`);
    }
    const from = "from admin_audit_log a left join profiles p on p.user_id = a.admin_id";
    const { limit, offset } = paging(data.page, data.pageSize);
    const [rows, count, admins] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select a.*, coalesce(p.display_name, 'Yönetici') as admin_name ${from} ${w.sql} order by a.created_at desc limit ${limit} offset ${offset}`,
        w.params,
      ),
      sql.query<{ n: number }>(`select count(*) as n ${from} ${w.sql}`, w.params),
      sql.query<{ user_id: string; display_name: string }>("select user_id, display_name from profiles where role = 'ADMIN' order by display_name"),
    ]);
    return { ...paged(rows.map(mapAudit), num(count[0]?.n), data.page, data.pageSize), admins };
  });

/* ───────────────────────────── System ───────────────────────────── */

const TABLES = [
  "listings",
  "categories",
  "attribute_defs",
  "profiles",
  "stores",
  "conversations",
  "messages",
  "notifications",
  "reports",
  "reviews",
  "favorites",
  "mobile_listing_images",
  "chat_images",
  "user_avatars",
  "mobile_push_tokens",
  "admin_audit_log",
] as const;

export const adminSystemInfo = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const counts: Record<string, number> = {};
    for (const t of TABLES) {
      try {
        const rows = await sql.query<{ n: number }>(`select count(*) as n from ${t}`);
        counts[t] = num(rows[0]?.n);
      } catch {
        counts[t] = -1;
      }
    }
    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch {
        return fallback;
      }
    };
    const [version, size, migrations, imageBytes, sessions] = await Promise.all([
      safe(async () => (await sql.query<{ v: string }>("select version() as v"))[0]?.v ?? "", ""),
      safe(async () => num((await sql.query<{ n: number }>("select pg_database_size(current_database()) as n"))[0]?.n), 0),
      safe(async () => {
        const rows = await sql.query<{ name: string; applied_at: unknown }>("select name, applied_at from _migrations order by name desc limit 8");
        return rows.map((r) => ({ name: r.name, applied_at: ts(r.applied_at) }));
      }, [] as Array<{ name: string; applied_at: string }>),
      safe(
        async () =>
          num(
            (
              await sql.query<{ n: number }>(
                "select coalesce((select sum(octet_length(data)) from mobile_listing_images),0) + coalesce((select sum(octet_length(data)) from chat_images),0) + coalesce((select sum(octet_length(data)) from user_avatars),0) as n",
              )
            )[0]?.n,
          ),
        0,
      ),
      safe(async () => num((await sql.query<{ n: number }>('select count(*) as n from "session" where "expiresAt" > now()'))[0]?.n), 0),
    ]);
    const env = (key: string) => Boolean(process.env[key]?.trim());
    const mem = process.memoryUsage();
    return {
      database: { source: dbSource, version: version.split(" on ")[0], size, imageBytes, sessions },
      counts,
      migrations,
      checks: [
        { key: "db", label: "Kalıcı veritabanı (DATABASE_URL)", ok: dbSource === "postgres" },
        { key: "auth", label: "Oturum anahtarı (BETTER_AUTH_SECRET)", ok: env("BETTER_AUTH_SECRET") || env("AUTH_SECRET") },
        { key: "mail", label: "E-posta gönderimi (SMTP)", ok: mailConfigured },
        { key: "google", label: "Google ile giriş", ok: env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET") },
        { key: "cron", label: "Zamanlanmış görevler (CRON_SECRET)", ok: env("CRON_SECRET") },
        { key: "admins", label: "Önyükleme yöneticileri (ADMIN_EMAILS)", ok: env("ADMIN_EMAILS") },
      ],
      runtime: {
        node: process.version,
        env: process.env.NODE_ENV ?? "development",
        uptime: Math.round(process.uptime()),
        rss: mem.rss,
        heapUsed: mem.heapUsed,
      },
    };
  });

/** Runs a housekeeping sweep now instead of waiting for the scheduler. */
export const adminRunMaintenance = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ task: z.enum(["expiry", "retention", "digest"]) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    let detail = "";
    if (data.task === "expiry") {
      const { sweepExpiryReminders } = await import("../ops");
      await sweepExpiryReminders(true);
      detail = "Süre hatırlatmaları gönderildi";
    } else if (data.task === "retention") {
      const { sweepRetention } = await import("../retention");
      await sweepRetention(true);
      detail = "Hesap ve sohbet temizliği çalıştırıldı";
    } else {
      const { sweepMessageDigests } = await import("../message-digest");
      await sweepMessageDigests(true);
      detail = "Okunmamış mesaj e-postaları gönderildi";
    }
    await audit(sql, context.adminId, `system.${data.task}`, "system", data.task, detail);
    return { ok: true as const, detail };
  });
