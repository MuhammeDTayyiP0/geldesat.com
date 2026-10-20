import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { asJson, num } from "@/lib/utils";
import { deleteUnusedListingImages } from "./upload.server";
import {
  inheritedAttributes,
  mapListing,
  subtreeIds,
  ensureProfile,
  creditBalance,
  rateLimit,
  notify,
  normalizeTrPhone,
  revealListingPhone,
  viewerKey,
} from "./helpers";
import { getRequest } from "@tanstack/react-start/server";
import { assertNotClosing, ListingInput, renewedStatus, saveListingRecord } from "./listing-write";

/** True only for a signed-in ADMIN; never throws, so routes can gate on it (e.g. 404 for everyone else). */
export const isAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const user = await getSessionUser();
  if (!user) return false;
  const profile = await ensureProfile(user.id);
  return profile.role === "ADMIN";
});

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    const rows = await sql.query<Record<string, unknown>>(
      `select p.*, 
        (select count(*)::int from listings where user_id = p.user_id) as listing_count,
        (select count(*)::int from listings where user_id = p.user_id and status = 'ACTIVE' and (expires_at is null or expires_at > now())) as active_count,
        (select count(*)::int from favorites f join listings l on l.id = f.listing_id
          where f.user_id = p.user_id and l.status = 'ACTIVE' and (l.expires_at is null or l.expires_at > now())) as favorite_count,
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
            description: store[0].description ? String(store[0].description) : "",
            phone: store[0].phone ? String(store[0].phone) : null,
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
      if (data.status === "ACTIVE") await assertNotClosing(sql, context.userId);
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
    await assertNotClosing(sql, context.userId);
    const nextStatus = renewedStatus(row[0].status, row[0].approved_at);
    await sql.query(
      `update listings set expires_at = now() + interval '30 days', status=$2, updated_at=now() where id=$1`,
      [data.id, nextStatus],
    );
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

export const STORE_BY_REQUEST = "Kurumsal mağazalar GeldeSat ekibi tarafından açılır. Başvuru için bizimle iletişime geçin.";

/** Edit the signed-in user's store. Creating one is not self-service. */
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
    // Stores are opened by the GeldeSat team after talking to the business; owners only edit theirs.
    throw new Error(STORE_BY_REQUEST);
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

/** Phone for a listing; anonymous viewers allowed only when the seller shows it to everyone. */
export const revealPhone = createServerFn({ method: "POST" })
  .validator(z.object({ listingId: z.string().max(200) }))
  .handler(async ({ data }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const user = await getSessionUser();
    const request = getRequest();
    rateLimit(`phone:${request ? viewerKey(request.headers, user?.id) : user?.id ?? "unknown"}`, 30, 60_000);
    return { phone: await revealListingPhone(data.listingId, user?.id ?? null) };
  });

export const getSeller = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const p = await sql.query<Record<string, unknown>>(
      `select p.*, 
        (select count(*)::int from listings where user_id=p.user_id and status='ACTIVE' and (expires_at is null or expires_at>now())) as listing_count,
        (select coalesce(avg(rating),0) from reviews where seller_id=p.user_id) as rating_avg,
        (select count(*)::int from reviews where seller_id=p.user_id) as rating_count
       from profiles p where p.user_id=$1 and p.deletion_requested_at is null and p.banned_at is null`,
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
        ? {
            name: String(store[0].name),
            slug: String(store[0].slug),
            plan: String(store[0].plan),
            description: store[0].description ? String(store[0].description) : null,
            city: store[0].city ? String(store[0].city) : null,
            logo: store[0].logo_url ? String(store[0].logo_url) : null,
          }
        : null,
      reviews: reviews.map((r) => ({
        id: String(r.id),
        rating: num(r.rating),
        comment: r.comment ? String(r.comment) : "",
        reviewer: r.reviewer_name == null ? "Silinmiş kullanıcı" : String(r.reviewer_name),
        at: String(r.created_at),
      })),
    };
  });

export const getStore = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    // A store disappears while its owner's account is waiting for deletion.
    const rows = await sql.query<Record<string, unknown>>(
      `select s.* from stores s join profiles p on p.user_id = s.user_id
       where lower(s.slug)=lower($1) and p.deletion_requested_at is null and p.banned_at is null`,
      [data.slug],
    );
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

export const getCategoryAttrs = createServerFn({ method: "POST" })
  .validator(z.object({ categoryId: z.string() }))
  .handler(async ({ data }) => inheritedAttributes(data.categoryId));

export const getSubtree = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => subtreeIds(data.slug));

