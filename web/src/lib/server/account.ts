import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { asJson, newId, num, slugify } from "@/lib/utils";
import { deleteUnusedListingImages } from "./upload.server";
import {
  inheritedAttributes,
  mapListing,
  subtreeIds,
  ensureProfile,
  requireAdmin,
  creditBalance,
  rateLimit,
  notify,
  normalizeTrPhone,
} from "./helpers";
import { ListingInput, renewedStatus, saveListingRecord } from "./listing-write";

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    const rows = await sql.query<Record<string, unknown>>(
      `select p.*, 
        (select count(*)::int from listings where user_id = p.user_id) as listing_count,
        (select count(*)::int from listings where user_id = p.user_id and status = 'ACTIVE') as active_count,
        (select count(*)::int from favorites where user_id = p.user_id) as favorite_count,
        (select coalesce(avg(rating),0) from reviews where seller_id = p.user_id) as rating_avg,
        (select count(*)::int from reviews where seller_id = p.user_id) as rating_count
       from profiles p where p.user_id = $1`,
      [context.userId],
    );
    const store = await sql.query<Record<string, unknown>>(
      "select * from stores where user_id = $1 limit 1",
      [context.userId],
    );
    const credits = await creditBalance(context.userId);
    const p = rows[0];
    return {
      userId: context.userId,
      profile: p
        ? {
            display_name: String(p.display_name ?? ""),
            phone: p.phone ? String(p.phone) : null,
            bio: p.bio ? String(p.bio) : null,
            city: p.city ? String(p.city) : null,
            district: p.district ? String(p.district) : null,
            avatar_url: p.avatar_url ? String(p.avatar_url) : null,
            role: String(p.role),
            listing_count: num(p.listing_count),
            active_count: num(p.active_count),
            favorite_count: num(p.favorite_count),
            rating_avg: num(p.rating_avg),
            rating_count: num(p.rating_count),
            created_at: String(p.created_at),
          }
        : null,
      store: store[0]
        ? {
            id: String(store[0].id),
            name: String(store[0].name),
            slug: String(store[0].slug),
            plan: String(store[0].plan),
            city: store[0].city ? String(store[0].city) : null,
          }
        : null,
      credits,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      display_name: z.string().min(2).max(60),
      phone: z.string().max(20).optional(),
      bio: z.string().max(400).optional(),
      city: z.string().max(40).optional(),
      district: z.string().max(40).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    const phone = data.phone?.trim() ? normalizeTrPhone(data.phone) : null;
    if (phone) {
      const taken = await sql.query<{ user_id: string }>(
        "select user_id from profiles where phone = $1 and user_id <> $2",
        [phone, context.userId],
      );
      if (taken[0]) throw new Error("Bu telefon başka bir hesapta kayıtlı.");
    }
    await sql.query(
      `update profiles set display_name=$2, phone=$3, bio=$4, city=$5, district=$6
       where user_id=$1`,
      [context.userId, data.display_name, phone, data.bio || null, data.city || null, data.district || null],
    );
    return { ok: true };
  });

export const saveListing = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(ListingInput).handler(async ({ context, data }) => saveListingRecord(context.userId, data));

export const setListingStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string(),
      status: z.enum(["ACTIVE", "INACTIVE", "SOLD", "PENDING", "REJECTED"]),
      reason: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(context.userId);
    const row = await sql.query<{ user_id: string; status: string; approved_at: string | null }>(
      "select user_id, status, approved_at from listings where id=$1",
      [data.id],
    );
    if (!row[0]) throw new Error("İlan bulunamadı");
    const isAdmin = me.role === "ADMIN";
    if (row[0].user_id !== context.userId && !isAdmin) throw new Error("Yetkisiz işlem");
    if (!isAdmin) {
      // Owners only toggle visibility; moderation states belong to admins.
      if (data.status === "PENDING" || data.status === "REJECTED") throw new Error("Yetkisiz işlem");
      if (data.status === "ACTIVE" && (row[0].status === "PENDING" || row[0].status === "REJECTED" || !row[0].approved_at)) {
        throw new Error("Onay bekleyen ilanı siz yayına alamazsınız.");
      }
    }
    // An admin publishing approves; an admin rejecting withdraws the approval.
    const approval = isAdmin && data.status === "ACTIVE" ? "now()" : isAdmin && data.status === "REJECTED" ? "null" : "approved_at";
    await sql.query(`update listings set status=$2, approved_at=${approval}, updated_at=now() where id=$1`, [data.id, data.status]);
    if (data.status === "ACTIVE" || data.status === "REJECTED") {
      const slug = await sql.query<{ slug: string }>("select slug from listings where id=$1", [data.id]);
      const rejectReason = data.reason?.trim() || "İlanınız yönetim ve yayın politikalarımıza uygun bulunmadı.";
      await notify(
        row[0].user_id,
        "listing",
        data.status === "ACTIVE" ? "İlanınız yayında" : "İlanınız reddedildi",
        data.status === "ACTIVE"
          ? "İlanınız onaylandı ve yayına alındı."
          : `İlanınız şu gerekçeyle reddedildi: ${rejectReason}. İlanınızı düzenleyip tekrar onaya gönderebilirsiniz.`,
        `/ilan/${slug[0]?.slug ?? data.id}`,
      );
    }
    return { ok: true };
  });

export const deleteListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(context.userId);
    const row = await sql.query<{ user_id: string; images: string[] }>("select user_id, images from listings where id=$1", [data.id]);
    if (!row[0]) throw new Error("İlan bulunamadı");
    if (row[0].user_id !== context.userId && me.role !== "ADMIN") throw new Error("Yetkisiz işlem");
    await sql.query("delete from listings where id=$1", [data.id]);
    await deleteUnusedListingImages(sql, row[0].user_id, asJson<string[]>(row[0].images, []));
    return { ok: true };
  });

export const renewListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await sql.query<{ user_id: string; status: string; approved_at: string | null }>(
      "select user_id, status, approved_at from listings where id=$1",
      [data.id],
    );
    if (!row[0] || row[0].user_id !== context.userId) throw new Error("İlan bulunamadı");
    if (row[0].status === "REJECTED") throw new Error("Reddedilen ilan yenilenemez.");
    const nextStatus = renewedStatus(row[0].status, row[0].approved_at);
    await sql.query(
      `update listings set expires_at = now() + interval '30 days', status=$2, updated_at=now() where id=$1`,
      [data.id, nextStatus],
    );
    return { ok: true };
  });

export const saveSiteSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      company_name: z.string().max(80),
      iban: z.string().max(40),
      bank_name: z.string().max(80),
      account_holder: z.string().max(80),
      support_email: z.string().max(80),
      support_phone: z.string().max(20),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const iban = data.iban.replace(/\s+/g, "").toUpperCase();
    if (iban && !/^TR\d{24}$/.test(iban)) throw new Error("IBAN TR ile başlamalı ve 26 karakter olmalı.");
    const phone = data.support_phone.trim() ? normalizeTrPhone(data.support_phone) : "";
    const sql = await getSql();
    const values: [string, string][] = [
      ["company_name", data.company_name.trim() || "GeldeSat"],
      ["iban", iban],
      ["bank_name", data.bank_name.trim()],
      ["account_holder", data.account_holder.trim()],
      ["support_email", data.support_email.trim() || "destek@geldesat.com"],
      ["support_phone", phone],
    ];
    for (const [key, value] of values) {
      await sql.query(
        `insert into site_settings (key, value) values ($1,$2)
         on conflict (key) do update set value = excluded.value`,
        [key, value],
      );
    }
    return { ok: true };
  });

export const myListings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select l.*, c.name as category_name, c.slug as category_slug,
              coalesce((select json_agg(b.kind) from boosts b where b.listing_id = l.id and b.ends_at > now()), '[]'::json) as boosts
       from listings l join categories c on c.id = l.category_id
       where l.user_id = $1 order by l.created_at desc`,
      [context.userId],
    );
    return rows.map(mapListing);
  });

export const getListingForEdit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(context.userId);
    const rows = await sql.query<Record<string, unknown>>(
      `select l.*, c.name as category_name, c.slug as category_slug
       from listings l join categories c on c.id = l.category_id
       where l.id = $1`,
      [data.id],
    );
    if (!rows[0]) throw new Error("İlan bulunamadı");
    if (String(rows[0].user_id) !== context.userId && me.role !== "ADMIN") {
      throw new Error("Yetkisiz işlem");
    }
    const listing = mapListing(rows[0]);
    const pathRows = await sql.query<{ id: string }>(
      `with recursive chain as (
         select id, parent_id from categories where id = $1
         union all
         select c.id, c.parent_id from categories c join chain ch on ch.parent_id = c.id
       )
       select id from chain`,
      [listing.category_id],
    );
    return {
      listing,
      path: [...pathRows.map((r) => r.id)].reverse(),
      phone: rows[0].phone_override ? String(rows[0].phone_override) : null,
    };
  });

export const upsertStore = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().min(3).max(60),
      description: z.string().max(400).optional(),
      city: z.string().optional(),
      phone: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    const storePhone = data.phone?.trim() ? normalizeTrPhone(data.phone) : null;
    const existing = await sql.query<{ id: string; slug: string }>(
      "select id, slug from stores where user_id=$1",
      [context.userId],
    );
    if (existing[0]) {
      await sql.query("update stores set name=$2, description=$3, city=$4, phone=$5 where id=$1", [
        existing[0].id,
        data.name,
        data.description || null,
        data.city || null,
        storePhone,
      ]);
      return { id: existing[0].id, slug: existing[0].slug };
    }
    const id = newId("str");
    const slug = `${slugify(data.name)}-${id.slice(-4)}`;
    await sql.query(
      `insert into stores (id, user_id, name, slug, description, city, phone, plan)
       values ($1,$2,$3,$4,$5,$6,$7,'BASIC')`,
      [id, context.userId, data.name, slug, data.description || null, data.city || null, storePhone],
    );
    return { id, slug };
  });

export const requestCreditOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ sku: z.string() }))
  .handler(async ({ context }) => {
    rateLimit(`pay:${context.userId}`, 8, 60_000);
    throw new Error("Kredi satışı şu an kapalı.");
  });

export const myCreditOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select id, sku, credits, price, status, created_at, resolved_at
       from credit_orders where user_id=$1 order by created_at desc limit 20`,
      [context.userId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      sku: String(r.sku),
      credits: num(r.credits),
      price: num(r.price),
      status: String(r.status),
      created_at: String(r.created_at),
      resolved_at: r.resolved_at ? String(r.resolved_at) : null,
    }));
  });

export const cancelCreditOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await sql.query<{ user_id: string; status: string }>(
      "select user_id, status from credit_orders where id=$1",
      [data.id],
    );
    if (!row[0] || row[0].user_id !== context.userId) throw new Error("Talep bulunamadı");
    if (row[0].status !== "PENDING") throw new Error("Bu talep iptal edilemez.");
    await sql.query("update credit_orders set status='CANCELLED', resolved_at=now() where id=$1", [data.id]);
    return { ok: true };
  });

export const applyBoost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ listingId: z.string(), kind: z.enum(["VITRIN", "ACIL", "KALIN"]) }))
  .handler(async () => {
    throw new Error("Doping şu an kapalı.");
  });

export const revealPhone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ listingId: z.string() }))
  .handler(async ({ context, data }) => {
    rateLimit(`phone:${context.userId}`, 30, 60_000);
    const sql = await getSql();
    const rows = await sql.query<{ phone_override: string | null; user_id: string }>(
      "select phone_override, user_id from listings where id=$1 and status='ACTIVE' and (expires_at is null or expires_at > now())",
      [data.listingId],
    );
    if (!rows[0]) throw new Error("İlan yok");
    const prof = await sql.query<{ phone: string | null }>(
      "select phone from profiles where user_id=$1",
      [rows[0].user_id],
    );
    const phone = rows[0].phone_override || prof[0]?.phone;
    if (!phone) throw new Error("Telefon paylaşılmamış");
    await sql.query("insert into phone_reveals (listing_id, viewer_id) values ($1,$2)", [data.listingId, context.userId]);
    return { phone };
  });

export const getSeller = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const p = await sql.query<Record<string, unknown>>(
      `select p.*, 
        (select count(*)::int from listings where user_id=p.user_id and status='ACTIVE') as listing_count,
        (select coalesce(avg(rating),0) from reviews where seller_id=p.user_id) as rating_avg,
        (select count(*)::int from reviews where seller_id=p.user_id) as rating_count
       from profiles p where p.user_id=$1`,
      [data.id],
    );
    if (!p[0]) return null;
    const reviews = await sql.query<Record<string, unknown>>(
      `select r.*, pr.display_name as reviewer_name
       from reviews r left join profiles pr on pr.user_id = r.reviewer_id
       where r.seller_id=$1 order by r.created_at desc limit 20`,
      [data.id],
    );
    const store = await sql.query<Record<string, unknown>>("select * from stores where user_id=$1 limit 1", [data.id]);
    return {
      id: String(p[0].user_id),
      name: String(p[0].display_name ?? "Satıcı"),
      city: p[0].city ? String(p[0].city) : null,
      bio: p[0].bio ? String(p[0].bio) : null,
      avatar: p[0].avatar_url ? String(p[0].avatar_url) : null,
      since: String(p[0].created_at),
      listing_count: num(p[0].listing_count),
      rating_avg: num(p[0].rating_avg),
      rating_count: num(p[0].rating_count),
      store: store[0]
        ? { name: String(store[0].name), slug: String(store[0].slug), plan: String(store[0].plan) }
        : null,
      reviews: reviews.map((r) => ({
        id: String(r.id),
        rating: num(r.rating),
        comment: r.comment ? String(r.comment) : "",
        reviewer: String(r.reviewer_name ?? "Üye"),
        at: String(r.created_at),
      })),
    };
  });

export const getStore = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>("select * from stores where lower(slug)=lower($1)", [data.slug]);
    if (!rows[0]) return null;
    return {
      id: String(rows[0].id),
      user_id: String(rows[0].user_id),
      name: String(rows[0].name),
      slug: String(rows[0].slug),
      description: rows[0].description ? String(rows[0].description) : "",
      city: rows[0].city ? String(rows[0].city) : null,
      phone: rows[0].phone ? String(rows[0].phone) : null,
      plan: String(rows[0].plan),
    };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const s = await sql.query<Record<string, number>>(
      `select
         (select count(*)::int from listings) as listings,
         (select count(*)::int from listings where status='PENDING') as pending,
         (select count(*)::int from listings where status='ACTIVE') as active,
         (select count(*)::int from profiles) as users,
         (select count(*)::int from reports where status='OPEN') as reports,
         (select count(*)::int from stores) as stores,
         (select count(*)::int from credit_orders where status='PENDING') as credit_orders`,
    );
    return s[0];
  });

export const adminListings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ status: z.string().optional() }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = data.status
      ? await sql.query<Record<string, unknown>>(
          `select l.*, c.name as category_name, p.display_name as seller_name
           from listings l join categories c on c.id=l.category_id
           left join profiles p on p.user_id=l.user_id
           where l.status=$1 order by l.created_at desc limit 80`,
          [data.status],
        )
      : await sql.query<Record<string, unknown>>(
          `select l.*, c.name as category_name, p.display_name as seller_name
           from listings l join categories c on c.id=l.category_id
           left join profiles p on p.user_id=l.user_id
           order by l.created_at desc limit 80`,
        );
    return rows.map(mapListing);
  });

export const adminReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select r.*, l.title, l.slug, p.display_name as reporter_name
       from reports r
       join listings l on l.id = r.listing_id
       left join profiles p on p.user_id = r.reporter_id
       order by r.created_at desc limit 80`,
    );
    return rows.map((r) => ({
      id: String(r.id),
      listing_id: String(r.listing_id),
      reason: String(r.reason),
      details: r.details ? String(r.details) : "",
      status: String(r.status),
      title: String(r.title ?? ""),
      slug: String(r.slug ?? ""),
      reporter_name: String(r.reporter_name ?? "Üye"),
      created_at: String(r.created_at),
    }));
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), status: z.enum(["OPEN", "CLOSED"]) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql.query("update reports set status=$2 where id=$1", [data.id, data.status]);
    return { ok: true };
  });

export const adminUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select p.*, u.email as user_email, (select count(*)::int from listings where user_id=p.user_id) as listing_count
       from profiles p
       left join "user" u on u.id = p.user_id
       order by p.created_at desc limit 250`,
    );
    return rows.map((p) => ({
      user_id: String(p.user_id),
      display_name: String(p.display_name ?? ""),
      email: p.user_email ? String(p.user_email) : null,
      phone: p.phone ? String(p.phone) : null,
      role: String(p.role),
      city: p.city ? String(p.city) : null,
      listing_count: num(p.listing_count),
      last_seen_at: p.last_seen_at ? String(p.last_seen_at) : null,
      created_at: String(p.created_at),
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string(), role: z.enum(["USER", "ADMIN"]) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (data.userId === context.userId && data.role !== "ADMIN") {
      throw new Error("Kendinizi yönetici olmaktan çıkaramazsınız.");
    }
    const sql = await getSql();
    await sql.query("update profiles set role=$2 where user_id=$1", [data.userId, data.role]);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string(),
      deleteListings: z.boolean().optional().default(true),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (data.userId === context.userId) {
      throw new Error("Kendi hesabınızı silemezsiniz.");
    }
    const sql = await getSql();
    const target = await sql.query<{ role: string; display_name: string }>(
      "select role, display_name from profiles where user_id=$1",
      [data.userId],
    );
    if (target[0]?.role === "ADMIN") {
      throw new Error("Yönetici rolündeki bir kullanıcıyı silemezsiniz. Lütfen önce rolünü 'USER' olarak değiştirin.");
    }

    // All or nothing: a failure part-way must not leave a half-deleted account.
    await sql.transaction(async (tx) => {
      await tx.query("delete from notifications where user_id=$1", [data.userId]);
      await tx.query("delete from mobile_push_tokens where user_id=$1", [data.userId]);
      await tx.query("delete from credit_ledger where user_id=$1", [data.userId]);
      await tx.query("delete from credit_orders where user_id=$1", [data.userId]);
      await tx.query("delete from boosts where user_id=$1", [data.userId]);
      await tx.query("delete from phone_reveals where viewer_id=$1", [data.userId]);
      await tx.query("delete from favorites where user_id=$1", [data.userId]);
      await tx.query("delete from reviews where seller_id=$1 or reviewer_id=$1", [data.userId]);
      await tx.query("delete from reports where reporter_id=$1", [data.userId]);
      await tx.query(
        `delete from messages where sender_id=$1 or conversation_id in (
           select id from conversations where buyer_id=$1 or seller_id=$1
         )`,
        [data.userId],
      );
      await tx.query("delete from conversations where buyer_id=$1 or seller_id=$1", [data.userId]);

      if (data.deleteListings) {
        await tx.query("delete from listings where user_id=$1", [data.userId]);
        await tx.query("delete from mobile_listing_images where user_id=$1", [data.userId]);
      } else {
        // Kept listings still reference the user's photos, so those stay.
        await tx.query("update listings set status='INACTIVE' where user_id=$1", [data.userId]);
        await tx.query(
          `delete from mobile_listing_images i where i.user_id=$1 and not exists (
             select 1 from listings l where l.user_id=$1 and (
               l.images @> jsonb_build_array('/api/mobile/images/' || i.id) or
               l.images @> jsonb_build_array('/uploads/' || i.storage_key)))`,
          [data.userId],
        );
      }

      await tx.query("delete from stores where user_id=$1", [data.userId]);
      await tx.query("delete from profiles where user_id=$1", [data.userId]);
      await tx.query('delete from "session" where "userId"=$1', [data.userId]);
      await tx.query('delete from "account" where "userId"=$1', [data.userId]);
      await tx.query('delete from "user" where id=$1', [data.userId]);
    });

    return { ok: true };
  });

export const adminCreditOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select o.*, p.display_name as buyer_name
       from credit_orders o
       left join profiles p on p.user_id = o.user_id
       order by o.created_at desc
       limit 80`,
    );
    return rows.map((r) => ({
      id: String(r.id),
      user_id: String(r.user_id),
      buyer_name: String(r.buyer_name ?? "Üye"),
      sku: String(r.sku),
      credits: num(r.credits),
      price: num(r.price),
      status: String(r.status),
      created_at: String(r.created_at),
      resolved_at: r.resolved_at ? String(r.resolved_at) : null,
    }));
  });

export const resolveCreditOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), status: z.enum(["PAID", "REJECTED"]) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const row = await sql.query<{ user_id: string; status: string; credits: number; sku: string }>(
      "select user_id, status, credits, sku from credit_orders where id=$1",
      [data.id],
    );
    if (!row[0]) throw new Error("Talep bulunamadı");
    if (row[0].status !== "PENDING") throw new Error("Bu talep zaten işlendi.");
    await sql.query("update credit_orders set status=$2, resolved_at=now() where id=$1", [data.id, data.status]);
    if (data.status === "PAID") {
      await sql.query("insert into credit_ledger (id, user_id, amount, reason) values ($1,$2,$3,$4)", [
        newId("crd"),
        row[0].user_id,
        num(row[0].credits),
        `order:${data.id}`,
      ]);
      await notify(row[0].user_id, "credit", "Krediniz yüklendi", `${row[0].credits} doping kredisi hesabınıza eklendi.`, "/doping");
    } else {
      await notify(row[0].user_id, "credit", "Kredi talebi reddedildi", "Havale bulunamadı veya iptal edildi. Destek: destek@geldesat.com", "/doping");
    }
    return { ok: true };
  });

export const getCategoryAttrs = createServerFn({ method: "POST" })
  .validator(z.object({ categoryId: z.string() }))
  .handler(async ({ data }) => inheritedAttributes(data.categoryId));

export const getSubtree = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => subtreeIds(data.slug));

export const adminSaveCategory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().optional(),
      parentId: z.string().nullable().optional(),
      name: z.string().min(1).max(80),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const name = data.name.trim();
    if (!name) throw new Error("Ad gerekli.");
    if (data.id) {
      const existing = await sql.query<{ id: string }>("select id from categories where id = $1", [data.id]);
      if (!existing[0]) throw new Error("Kategori bulunamadı.");
      await sql.query("update categories set name = $1 where id = $2", [name, data.id]);
      return { ok: true as const, id: data.id };
    }
    const parent = data.parentId ?? null;
    if (parent) {
      const p = await sql.query<{ id: string }>("select id from categories where id = $1", [parent]);
      if (!p[0]) throw new Error("Üst kategori yok.");
    }
    const base = slugify(parent ? `${parent}-${name}` : name) || "kategori";
    let id = base;
    let n = 2;
    while (true) {
      const exists = await sql.query<{ id: string }>("select id from categories where id = $1 or slug = $1", [id]);
      if (!exists[0]) break;
      id = `${base}-${n++}`;
    }
    const max = await sql.query<{ m: number }>(
      "select coalesce(max(sort_order), -1)::int as m from categories where parent_id is not distinct from $1",
      [parent],
    );
    await sql.query(
      "insert into categories (id, name, slug, parent_id, sort_order) values ($1, $2, $1, $3, $4)",
      [id, name, parent, (max[0]?.m ?? -1) + 1],
    );
    return { ok: true as const, id };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const kids = await sql.query<{ n: number }>(
      "select count(*)::int as n from categories where parent_id = $1",
      [data.id],
    );
    if ((kids[0]?.n ?? 0) > 0) throw new Error("Önce alt kategorileri silin.");
    const used = await sql.query<{ n: number }>(
      "select count(*)::int as n from listings where category_id = $1",
      [data.id],
    );
    if ((used[0]?.n ?? 0) > 0) throw new Error("Bu kategoride ilan var, silinemez.");
    await sql.query("delete from categories where id = $1", [data.id]);
    return { ok: true as const };
  });

