import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { newId, num } from "@/lib/utils";
import { creditBalance, normalizeTrPhone, notify } from "../helpers";
import { purgeUserData } from "../account-purge";
import { adminMiddleware, audit, likeTerm, paged, paging, PageInput, strOrNull, ts, tsOrNull, Where } from "./common";
import { mapAudit } from "./dashboard";

const ListFilter = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(["ALL", "ADMIN", "USER"]).default("ALL"),
  state: z.enum(["all", "active", "banned", "closing", "unverified", "store", "no_phone"]).default("all"),
  sort: z.enum(["newest", "oldest", "last_seen", "listings", "name"]).default("newest"),
  ...PageInput,
});

const ORDER: Record<z.infer<typeof ListFilter>["sort"], string> = {
  newest: "p.created_at desc",
  oldest: "p.created_at asc",
  last_seen: "p.last_seen_at desc nulls last",
  listings: "listing_count desc, p.created_at desc",
  name: "p.display_name asc",
};

function mapUser(x: Record<string, unknown>) {
  return {
    user_id: String(x.user_id),
    display_name: String(x.display_name ?? ""),
    email: strOrNull(x.email),
    email_verified: Boolean(x.email_verified),
    phone: strOrNull(x.phone),
    city: strOrNull(x.city),
    role: String(x.role),
    avatar_url: strOrNull(x.avatar_url),
    created_at: ts(x.created_at),
    last_seen_at: tsOrNull(x.last_seen_at),
    banned_at: tsOrNull(x.banned_at),
    ban_reason: strOrNull(x.ban_reason),
    deletion_requested_at: tsOrNull(x.deletion_requested_at),
    listing_count: num(x.listing_count),
    active_count: num(x.active_count),
    store_name: strOrNull(x.store_name),
    providers: Array.isArray(x.providers) ? (x.providers as string[]) : [],
  };
}

export type AdminUserRow = ReturnType<typeof mapUser>;

const USER_SELECT = `
  p.user_id, p.display_name, p.phone, p.city, p.role, p.avatar_url, p.created_at, p.last_seen_at,
  p.banned_at, p.ban_reason, p.deletion_requested_at,
  u.email, u."emailVerified" as email_verified,
  (select count(*) from listings l where l.user_id = p.user_id) as listing_count,
  (select count(*) from listings l where l.user_id = p.user_id and l.status = 'ACTIVE') as active_count,
  (select s.name from stores s where s.user_id = p.user_id limit 1) as store_name,
  coalesce((select json_agg(distinct a."providerId") from "account" a where a."userId" = p.user_id), '[]'::json) as providers`;

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(ListFilter)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.role !== "ALL") w.add(`p.role = ${w.param(data.role)}`);
    if (data.state === "active") w.add("p.banned_at is null and p.deletion_requested_at is null");
    if (data.state === "banned") w.add("p.banned_at is not null");
    if (data.state === "closing") w.add("p.deletion_requested_at is not null");
    if (data.state === "unverified") w.add('coalesce(u."emailVerified", false) = false');
    if (data.state === "store") w.add("exists (select 1 from stores s where s.user_id = p.user_id)");
    if (data.state === "no_phone") w.add("(p.phone is null or p.phone = '')");
    if (data.q) {
      const like = w.param(likeTerm(data.q));
      const digits = data.q.replace(/\D/g, "");
      w.add(
        `(p.display_name ilike ${like} or u.email ilike ${like} or p.city ilike ${like} or p.user_id = ${w.param(data.q)}` +
          (digits.length >= 4 ? ` or p.phone like ${w.param(`%${digits.slice(-10)}%`)}` : "") +
          ")",
      );
    }
    const { limit, offset } = paging(data.page, data.pageSize);
    const from = `from profiles p left join "user" u on u.id = p.user_id`;
    const [rows, count, totals] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select ${USER_SELECT} ${from} ${w.sql} order by ${ORDER[data.sort]} limit ${limit} offset ${offset}`,
        w.params,
      ),
      sql.query<{ n: number }>(`select count(*) as n ${from} ${w.sql}`, w.params),
      sql.query<Record<string, unknown>>(
        `select count(*) as all,
                count(*) filter (where role = 'ADMIN') as admins,
                count(*) filter (where banned_at is not null) as banned,
                count(*) filter (where deletion_requested_at is not null) as closing,
                count(*) filter (where created_at > now() - interval '7 days') as new_7d,
                count(*) filter (where last_seen_at > now() - interval '1 day') as active_24h
         from profiles`,
      ),
    ]);
    const t = totals[0] ?? {};
    return {
      ...paged(rows.map(mapUser), num(count[0]?.n), data.page, data.pageSize),
      totals: {
        all: num(t.all),
        admins: num(t.admins),
        banned: num(t.banned),
        closing: num(t.closing),
        new_7d: num(t.new_7d),
        active_24h: num(t.active_24h),
      },
    };
  });

export const adminUserDetail = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.string().max(200) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${USER_SELECT}, p.bio, p.district, p.admin_note, p.phone_visibility, p.message_email,
              u."createdAt" as auth_created_at
       from profiles p left join "user" u on u.id = p.user_id where p.user_id = $1`,
      [data.userId],
    );
    const x = rows[0];
    if (!x) throw new Error("Kullanıcı bulunamadı.");
    const [stats, sessions, listings, reviews, reportsAgainst, store, log, credits] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select
           (select count(*) from listings where user_id = $1 and status = 'PENDING') as pending,
           (select count(*) from listings where user_id = $1 and status = 'REJECTED') as rejected,
           (select count(*) from listings where user_id = $1 and status in ('INACTIVE','SOLD')) as inactive,
           (select coalesce(sum(view_count), 0) from listings where user_id = $1) as views,
           (select count(*) from favorites where user_id = $1) as favorites,
           (select count(*) from conversations where buyer_id = $1 or seller_id = $1) as conversations,
           (select count(*) from messages where sender_id = $1) as messages_sent,
           (select count(*) from reviews where seller_id = $1) as reviews_received,
           (select coalesce(avg(rating), 0) from reviews where seller_id = $1) as rating_avg,
           (select count(*) from reports where reporter_id = $1) as reports_filed,
           (select count(*) from user_blocks where blocked_id = $1) as blocked_by`,
        [data.userId],
      ),
      sql.query<Record<string, unknown>>(
        `select id, "createdAt" as created_at, "expiresAt" as expires_at, "ipAddress" as ip, "userAgent" as ua
         from "session" where "userId" = $1 and "expiresAt" > now() order by "createdAt" desc limit 10`,
        [data.userId],
      ),
      sql.query<Record<string, unknown>>(
        `select l.id, l.listing_no, l.title, l.status, l.price, l.currency, l.created_at, l.expires_at,
                case when jsonb_array_length(l.images) > 0 then l.images->>0 end as cover, c.name as category_name
         from listings l join categories c on c.id = l.category_id
         where l.user_id = $1 order by l.created_at desc limit 12`,
        [data.userId],
      ),
      sql.query<Record<string, unknown>>(
        `select r.id, r.rating, r.comment, r.created_at, coalesce(p.display_name, 'Silinmiş kullanıcı') as reviewer_name
         from reviews r left join profiles p on p.user_id = r.reviewer_id
         where r.seller_id = $1 order by r.created_at desc limit 8`,
        [data.userId],
      ),
      sql.query<Record<string, unknown>>(
        `select r.id, r.reason, r.status, r.created_at, l.title
         from reports r join listings l on l.id = r.listing_id
         where l.user_id = $1 order by r.created_at desc limit 8`,
        [data.userId],
      ),
      sql.query<Record<string, unknown>>("select id, name, slug, plan from stores where user_id = $1 limit 1", [data.userId]),
      sql.query<Record<string, unknown>>(
        `select a.*, coalesce(p.display_name, 'Yönetici') as admin_name
         from admin_audit_log a left join profiles p on p.user_id = a.admin_id
         where a.target_type = 'user' and a.target_id = $1
         order by a.created_at desc limit 20`,
        [data.userId],
      ),
      creditBalance(data.userId),
    ]);
    const s = stats[0] ?? {};
    return {
      user: {
        ...mapUser(x),
        bio: strOrNull(x.bio),
        district: strOrNull(x.district),
        admin_note: strOrNull(x.admin_note),
        phone_visibility: String(x.phone_visibility ?? "members"),
        message_email: Boolean(x.message_email),
      },
      stats: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, num(v)])) as Record<string, number>,
      credits,
      sessions: sessions.map((r) => ({
        id: String(r.id),
        created_at: ts(r.created_at),
        expires_at: ts(r.expires_at),
        ip: strOrNull(r.ip),
        ua: strOrNull(r.ua),
      })),
      listings: listings.map((r) => ({
        id: String(r.id),
        listing_no: num(r.listing_no),
        title: String(r.title),
        status: String(r.status),
        price: num(r.price),
        currency: String(r.currency ?? "TRY"),
        cover: strOrNull(r.cover),
        category_name: String(r.category_name),
        created_at: ts(r.created_at),
        expires_at: tsOrNull(r.expires_at),
      })),
      reviews: reviews.map((r) => ({
        id: String(r.id),
        rating: num(r.rating),
        comment: strOrNull(r.comment),
        reviewer_name: String(r.reviewer_name),
        created_at: ts(r.created_at),
      })),
      reportsAgainst: reportsAgainst.map((r) => ({
        id: String(r.id),
        reason: String(r.reason),
        status: String(r.status),
        title: String(r.title ?? ""),
        created_at: ts(r.created_at),
      })),
      store: store[0] ? { id: String(store[0].id), name: String(store[0].name), slug: String(store[0].slug), plan: String(store[0].plan) } : null,
      log: log.map(mapAudit),
    };
  });

export type AdminUserDetail = Awaited<ReturnType<typeof adminUserDetail>>;

async function targetProfile(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const rows = await sql.query<{ role: string; display_name: string; banned_at: unknown }>(
    "select role, display_name, banned_at from profiles where user_id = $1",
    [userId],
  );
  if (!rows[0]) throw new Error("Kullanıcı bulunamadı.");
  return rows[0];
}

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.string().max(200), role: z.enum(["USER", "ADMIN"]) }))
  .handler(async ({ context, data }) => {
    if (data.userId === context.adminId && data.role !== "ADMIN") throw new Error("Kendi yönetici yetkinizi kaldıramazsınız.");
    const sql = await getSql();
    const t = await targetProfile(sql, data.userId);
    if (t.banned_at && data.role === "ADMIN") throw new Error("Askıdaki bir hesap yönetici yapılamaz.");
    await sql.query("update profiles set role = $2 where user_id = $1", [data.userId, data.role]);
    await audit(sql, context.adminId, "user.role", "user", data.userId, `${t.display_name}: rol ${t.role} → ${data.role}`);
    return { ok: true as const };
  });

/** Suspend: no sign-in, sessions ended, live and pending listings hidden until the ban is lifted. */
export const adminBanUser = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.string().max(200), reason: z.string().trim().min(3).max(300) }))
  .handler(async ({ context, data }) => {
    if (data.userId === context.adminId) throw new Error("Kendi hesabınızı askıya alamazsınız.");
    const sql = await getSql();
    const t = await targetProfile(sql, data.userId);
    if (t.role === "ADMIN") throw new Error("Yönetici hesabı askıya alınamaz. Önce rolünü üyeye çevirin.");
    const hidden = await sql.transaction(async (tx) => {
      await tx.query("update profiles set banned_at = coalesce(banned_at, now()), ban_reason = $2 where user_id = $1", [data.userId, data.reason]);
      const rows = await tx.query<{ id: string }>(
        `update listings set status_before_ban = status, status = 'INACTIVE', updated_at = now()
         where user_id = $1 and status in ('ACTIVE','PENDING') and status_before_ban is null
         returning id`,
        [data.userId],
      );
      await tx.query('delete from "session" where "userId" = $1', [data.userId]);
      await tx.query("delete from mobile_push_tokens where user_id = $1", [data.userId]);
      return rows.length;
    });
    await audit(sql, context.adminId, "user.ban", "user", data.userId, `${t.display_name} askıya alındı — ${data.reason}`, { hiddenListings: hidden });
    return { ok: true as const, hiddenListings: hidden };
  });

export const adminUnbanUser = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.string().max(200), restoreListings: z.boolean().default(true) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const t = await targetProfile(sql, data.userId);
    const restored = await sql.transaction(async (tx) => {
      await tx.query("update profiles set banned_at = null, ban_reason = null where user_id = $1", [data.userId]);
      if (!data.restoreListings) {
        await tx.query("update listings set status_before_ban = null where user_id = $1", [data.userId]);
        return 0;
      }
      const rows = await tx.query<{ id: string }>(
        `update listings set status = status_before_ban, status_before_ban = null, updated_at = now()
         where user_id = $1 and status_before_ban is not null returning id`,
        [data.userId],
      );
      return rows.length;
    });
    await audit(sql, context.adminId, "user.unban", "user", data.userId, `${t.display_name} askıdan çıkarıldı`, { restoredListings: restored });
    return { ok: true as const, restoredListings: restored };
  });

export const adminRevokeSessions = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.string().max(200), sessionId: z.string().max(200).optional() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const t = await targetProfile(sql, data.userId);
    const rows = data.sessionId
      ? await sql.query<{ id: string }>('delete from "session" where "userId" = $1 and id = $2 returning id', [data.userId, data.sessionId])
      : await sql.query<{ id: string }>('delete from "session" where "userId" = $1 returning id', [data.userId]);
    await audit(sql, context.adminId, "user.sessions", "user", data.userId, `${t.display_name}: ${rows.length} oturum kapatıldı`);
    return { ok: true as const, count: rows.length };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      userId: z.string().max(200),
      display_name: z.string().trim().min(2).max(60),
      phone: z.string().trim().max(20).optional(),
      city: z.string().trim().max(40).optional(),
      district: z.string().trim().max(40).optional(),
      bio: z.string().trim().max(400).optional(),
      admin_note: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const t = await targetProfile(sql, data.userId);
    const phone = data.phone ? normalizeTrPhone(data.phone) : null;
    if (phone) {
      const taken = await sql.query<{ user_id: string }>("select user_id from profiles where phone = $1 and user_id <> $2", [phone, data.userId]);
      if (taken[0]) throw new Error("Bu telefon başka bir hesapta kayıtlı.");
    }
    await sql.query(
      `update profiles set display_name=$2, phone=$3, city=$4, district=$5, bio=$6, admin_note=$7 where user_id=$1`,
      [data.userId, data.display_name, phone, data.city || null, data.district || null, data.bio || null, data.admin_note || null],
    );
    await audit(sql, context.adminId, "user.edit", "user", data.userId, `${t.display_name}: profil bilgileri düzenlendi`);
    return { ok: true as const };
  });

/** Marks the sign-in e-mail verified (e.g. when the verification mail never arrived). */
export const adminVerifyEmail = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.string().max(200) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const t = await targetProfile(sql, data.userId);
    await sql.query('update "user" set "emailVerified" = true, "updatedAt" = now() where id = $1', [data.userId]);
    await audit(sql, context.adminId, "user.verify", "user", data.userId, `${t.display_name}: e-posta doğrulandı olarak işaretlendi`);
    return { ok: true as const };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.string().max(200), deleteListings: z.boolean().default(true) }))
  .handler(async ({ context, data }) => {
    if (data.userId === context.adminId) throw new Error("Kendi hesabınızı silemezsiniz.");
    const sql = await getSql();
    const t = await targetProfile(sql, data.userId);
    if (t.role === "ADMIN") throw new Error("Yönetici hesabı silinemez. Önce rolünü üyeye çevirin.");
    await purgeUserData(sql, data.userId, { deleteListings: data.deleteListings });
    await audit(sql, context.adminId, "user.delete", "user", data.userId, `${t.display_name} hesabı kalıcı olarak silindi`, {
      deleteListings: data.deleteListings,
    });
    return { ok: true as const };
  });

/** Adds (or with a negative amount, removes) doping credits. */
export const adminGrantCredits = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      userId: z.string().max(200),
      amount: z.number().int().min(-100_000).max(100_000).refine((n) => n !== 0, "Miktar sıfır olamaz."),
      reason: z.string().trim().min(3).max(200),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const t = await targetProfile(sql, data.userId);
    await sql.query("insert into credit_ledger (id, user_id, amount, reason) values ($1,$2,$3,$4)", [
      newId("crd"),
      data.userId,
      data.amount,
      `admin:${data.reason}`,
    ]);
    if (data.amount > 0) {
      await notify(data.userId, "credit", "Hesabınıza kredi eklendi", `${data.amount} doping kredisi hesabınıza tanımlandı.`, "/doping");
    }
    await audit(sql, context.adminId, "user.credits", "user", data.userId, `${t.display_name}: ${data.amount > 0 ? "+" : ""}${data.amount} kredi — ${data.reason}`);
    return { ok: true as const, balance: await creditBalance(data.userId) };
  });

export const adminNotifyUser = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      userId: z.string().max(200),
      title: z.string().trim().min(2).max(120),
      body: z.string().trim().min(2).max(1000),
      link: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const t = await targetProfile(sql, data.userId);
    const link = data.link && data.link.startsWith("/") ? data.link : "/bildirimler";
    await notify(data.userId, "system", data.title, data.body, link);
    await audit(sql, context.adminId, "user.notify", "user", data.userId, `${t.display_name}: bildirim gönderildi — ${data.title}`);
    return { ok: true as const };
  });
