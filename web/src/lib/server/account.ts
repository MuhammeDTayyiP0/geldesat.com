import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { asIso, asJson, formatPrice, listingSlug, newId, num } from "@/lib/utils";
import { getAppConfig, resolveFlags } from "./config";
import { getCategoryTree } from "./category-cache";
import { notifySellerFollowers } from "./follows";
import { deleteUnusedListingImages } from "./upload.server";
import {
  inheritedAttributes,
  isActiveAdmin,
  mapListing,
  subtreeIds,
  ensureProfile,
  creditBalance,
  rateLimit,
  notify,
  normalizeTrPhone,
  listingSelect,
  PHONE_UNAVAILABLE,
  revealListingPhone,
  viewerKey,
} from "./helpers";
import { notifyMatchingSavedSearches } from "./saved-searches";
import { getRequest } from "@tanstack/react-start/server";
import {
  maxActiveListingsFor,
  normalizeAndValidateTaxNo,
  STORE_APP_COOLDOWN_DAYS,
  type BusinessType,
} from "@/lib/account-type";
import { resolveUserPrefs } from "@/lib/user-prefs";
import { assertOwnerStatus, assertRenewable, isExpired } from "@/lib/listing-status";
import { audit } from "./admin/common";
import { getSellerResponseStats } from "./chat";
import { assertNotClosing, ListingInput, saveListingRecord } from "./listing-write";

/** True only for a signed-in ADMIN; never throws, so routes can gate on it (e.g. 404 for everyone else). */
export const isAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const user = await getSessionUser();
  if (!user) return false;
  const profile = await ensureProfile(user.id);
  return isActiveAdmin(profile);
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
    const [credits, authUserRows, activeOrPendingRows] = await Promise.all([
      creditBalance(context.userId),
      sql.query<{ emailVerified: boolean }>('select "emailVerified" from "user" where id = $1 limit 1', [context.userId]).catch(() => []),
      sql.query<{ n: number }>(
        "select count(*)::int as n from listings where user_id = $1 and status in ('ACTIVE', 'PENDING') and (expires_at is null or expires_at > now())",
        [context.userId],
      ),
    ]);
    const p = rows[0];
    const accountType = p?.account_type === "CORPORATE" || Boolean(store[0]) ? "CORPORATE" : "INDIVIDUAL";
    const storePlan = store[0] ? String(store[0].plan) : null;
    const maxListings = maxActiveListingsFor(accountType, storePlan);
    return {
      userId: context.userId,
      emailVerified: Boolean(authUserRows[0]?.emailVerified),
      listingLimit: {
        used: num(activeOrPendingRows[0]?.n),
        max: maxListings,
        isCorporate: accountType === "CORPORATE",
      },
      profile: p
        ? {
            display_name: String(p.display_name ?? ""),
            phone: p.phone ? String(p.phone) : null,
            bio: p.bio ? String(p.bio) : null,
            city: p.city ? String(p.city) : null,
            district: p.district ? String(p.district) : null,
            avatar_url: p.avatar_url ? String(p.avatar_url) : null,
            role: String(p.role),
            account_type: accountType as "INDIVIDUAL" | "CORPORATE",
            listing_count: num(p.listing_count),
            active_count: num(p.active_count),
            favorite_count: num(p.favorite_count),
            rating_avg: num(p.rating_avg),
            rating_count: num(p.rating_count),
            created_at: asIso(p.created_at),
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
            logo_url: store[0].logo_url ? String(store[0].logo_url) : null,
            business_type: store[0].business_type ? String(store[0].business_type) : null,
            sector: store[0].sector ? String(store[0].sector) : null,
            tax_office: store[0].tax_office ? String(store[0].tax_office) : null,
            tax_no: store[0].tax_no ? String(store[0].tax_no) : null,
            address: store[0].address ? String(store[0].address) : null,
          }
        : null,
      credits,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      display_name: z.string().trim().min(2).max(60),
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
      rateLimit(`phone-check:${context.userId}`, 20, 60 * 60_000);
      const taken = await sql.query<{ user_id: string }>(
        "select user_id from profiles where phone = $1 and user_id <> $2",
        [phone, context.userId],
      );
      if (taken[0]) throw new Error(PHONE_UNAVAILABLE);
    }
    // Both clients send the whole form, and an omitted field means "cleared".
    try {
      await sql.query(
        `update profiles set display_name=$2, phone=$3, bio=$4, city=$5, district=$6
         where user_id=$1`,
        [context.userId, data.display_name, phone, data.bio || null, data.city || null, data.district || null],
      );
      await sql.query(
        "update stores set name=$2, phone=$3, description=$4, city=$5 where user_id=$1",
        [context.userId, data.display_name, phone, data.bio || null, data.city || null],
      );
    } catch (err) {
      const pgErr = err as { code?: string; constraint?: string };
      if (
        pgErr.code === "23505" &&
        (pgErr.constraint === "profiles_phone_unique" ||
          (err instanceof Error && err.message.includes("profiles_phone_unique")))
      ) {
        throw new Error(PHONE_UNAVAILABLE);
      }
      throw err;
    }
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
    const isAdmin = isActiveAdmin(me);

    const txRes = await sql.transaction(async (tx) => {
      const row = await tx.query<{
        user_id: string;
        status: string;
        approved_at: string | null;
        expires_at: unknown;
        title: string;
        listing_no: number;
        slug: string;
        category_id: string;
        city: string | null;
        district: string | null;
        neighborhood: string | null;
        price: string | number;
        images: unknown;
        attrs: unknown;
        store_id: string | null;
      }>(
        `select user_id, status, approved_at, expires_at, title, listing_no, slug,
                category_id, city, district, neighborhood, price, images, attrs, store_id
         from listings where id=$1 for update`,
        [data.id],
      );
      const cur = row[0];
      if (!cur) throw new Error("İlan bulunamadı");
      const isOwner = cur.user_id === context.userId;
      if (!isOwner && !isAdmin) throw new Error("Yetkisiz işlem");
      if (!isAdmin) {
        if (data.status === "ACTIVE") await assertNotClosing(tx, context.userId);
        assertOwnerStatus(data.status, { status: cur.status, approved: Boolean(cur.approved_at), expired: isExpired(cur.expires_at as string | null) });
      } else if (data.status === "ACTIVE" && !isOwner) {
        const sellerProf = await tx.query<{ banned_at: unknown; deletion_requested_at: unknown }>(
          "select banned_at, deletion_requested_at from profiles where user_id=$1",
          [cur.user_id],
        );
        if (sellerProf[0]?.banned_at || sellerProf[0]?.deletion_requested_at) {
          throw new Error("Askıda veya silinme sürecindeki üyenin ilanı yayına alınamaz.");
        }
      }

      const rejectReason = data.status === "REJECTED" ? (data.reason?.trim() || "İlanınız yönetim ve yayın politikalarımıza uygun bulunmadı.") : null;
      const approval = isAdmin && data.status === "ACTIVE" ? "now()" : isAdmin && data.status === "REJECTED" ? "null" : "approved_at";
      const expiry = isAdmin && data.status === "ACTIVE" ? "greatest(coalesce(expires_at, now()), now() + interval '30 days')" : "expires_at";
      await tx.query(
        `update listings
         set status=$2, approved_at=${approval}, expires_at=${expiry},
             rejection_reason=case when $2::text = 'REJECTED' then $3 when $2::text in ('ACTIVE','PENDING') then null else rejection_reason end,
             status_before_ban=null, updated_at=now()
         where id=$1`,
        [data.id, data.status, rejectReason],
      );
      return { cur, isOwner, rejectReason };
    });

    const { cur, isOwner, rejectReason } = txRes;
    if (isAdmin && !isOwner) {
      await audit(sql, context.userId, "listing.status", "listing", data.id, `#${cur.listing_no} "${cur.title}" site üzerinden ${data.status} yapıldı`, { from: cur.status, to: data.status, reason: data.reason });
    }
    // Only a moderator's decision is news to the owner; their own switch is not.
    if (isAdmin && !isOwner && (data.status === "ACTIVE" || data.status === "REJECTED")) {
      await notify(
        cur.user_id,
        "listing",
        data.status === "ACTIVE" ? "İlanınız yayında" : "İlanınız reddedildi",
        data.status === "ACTIVE"
          ? "İlanınız onaylandı ve yayına alındı."
          : `İlanınız şu gerekçeyle reddedildi: ${rejectReason}. İlanınızı düzenleyip tekrar onaya gönderebilirsiniz.`,
        `/ilan/${cur.slug}`,
      );
    }
    if (cur.status !== "ACTIVE" && data.status === "ACTIVE") {
      const tree = await getCategoryTree();
      const cat = tree.byId.get(cur.category_id);
      const sellerRows = await sql.query<{ display_name: string }>("select display_name from profiles where user_id=$1", [cur.user_id]);
      const sellerName = sellerRows[0]?.display_name || "Satıcı";
      void notifyMatchingSavedSearches(sql, {
        id: data.id,
        title: cur.title,
        slug: cur.slug,
        categoryId: cur.category_id,
        categorySlug: cat?.slug ?? "",
        city: cur.city ?? "",
        district: cur.district ?? "",
        neighborhood: cur.neighborhood ?? null,
        price: num(cur.price),
        userId: cur.user_id,
        hasImages: asJson<string[]>(cur.images, []).length > 0,
        isStore: Boolean(cur.store_id),
        attrs: asJson<Record<string, unknown>>(cur.attrs, {}),
      }).catch((err) => console.warn("[saved-searches] match notify failed", err));
      void notifySellerFollowers(sql, {
        id: data.id,
        title: cur.title,
        slug: cur.slug,
        userId: cur.user_id,
        sellerName,
      }).catch((err) => console.warn("[follows] notify failed", err));
    }
    return { ok: true };
  });

export const deleteListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(context.userId);
    const row = await sql.query<{ user_id: string; images: string[]; title: string; listing_no: number }>("select user_id, images, title, listing_no from listings where id=$1", [data.id]);
    if (!row[0]) throw new Error("İlan bulunamadı");
    if (row[0].user_id !== context.userId && !isActiveAdmin(me)) throw new Error("Yetkisiz işlem");
    if (row[0].user_id !== context.userId) {
      await audit(sql, context.userId, "listing.delete", "listing", data.id, `#${row[0].listing_no} "${row[0].title}" site üzerinden silindi`);
    }
    await sql.query("delete from listings where id=$1", [data.id]);
    await deleteUnusedListingImages(sql, row[0].user_id, asJson<string[]>(row[0].images, []));
    return { ok: true };
  });

export const renewListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await sql.query<{ user_id: string; status: string }>("select user_id, status from listings where id=$1", [data.id]);
    if (!row[0] || row[0].user_id !== context.userId) throw new Error("İlan bulunamadı");
    assertRenewable(row[0].status);
    await assertNotClosing(sql, context.userId);
    await sql.query("update listings set expires_at = now() + interval '30 days', updated_at=now() where id=$1", [data.id]);
    return { ok: true };
  });

export const myListings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${listingSelect("", true)}, l.rejection_reason, (l.approved_at is not null) as approved,
              (select count(*)::int from favorites f where f.listing_id = l.id) as fav_count,
              (select count(*)::int from conversations cv where cv.listing_id = l.id) as message_count,
              (select count(*)::int from phone_reveals pr where pr.listing_id = l.id) as phone_reveal_count,
              coalesce((select json_agg(b.kind) from boosts b where b.listing_id = l.id and b.ends_at > now()), '[]'::json) as boosts
       from listings l
       join categories c on c.id = l.category_id
       left join profiles p on p.user_id = l.user_id
       left join stores s on s.id = l.store_id
       where l.user_id = $1 order by l.created_at desc limit 500`,
      [context.userId],
    );
    return rows.map((row) => ({
      ...mapListing(row),
      rejection_reason: row.rejection_reason ? String(row.rejection_reason) : null,
      approved: Boolean(row.approved),
      fav_count: num(row.fav_count),
      message_count: num(row.message_count),
      phone_reveal_count: num(row.phone_reveal_count),
    }));
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
    const listing = {
      ...mapListing(rows[0]),
      rejection_reason: rows[0].rejection_reason ? String(rows[0].rejection_reason) : null,
    };
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
      name: z.string().trim().min(3).max(60),
      description: z.string().trim().max(400).optional(),
      city: z.string().max(40).optional(),
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
      created_at: asIso(r.created_at),
      resolved_at: r.resolved_at ? asIso(r.resolved_at) : null,
    }));
  });

export const cancelCreditOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cancelled = await sql.query(
      "update credit_orders set status='CANCELLED', resolved_at=now() where id=$1 and user_id=$2 and status='PENDING' returning id",
      [data.id, context.userId],
    );
    if (!cancelled[0]) throw new Error("Bu talep iptal edilemez.");
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
    const viewer = request ? viewerKey(request.headers, user?.id) : user?.id ?? "unknown";
    rateLimit(`phone:${viewer}`, 30, 60_000);
    if (!user) rateLimit(`phone-day:${viewer}`, 100, 24 * 60 * 60_000);
    return { phone: await revealListingPhone(data.listingId, user?.id ?? null) };
  });

const mapReview = (r: Record<string, unknown>) => ({
        id: String(r.id),
        rating: num(r.rating),
        comment: r.comment ? String(r.comment) : "",
        reviewer: r.reviewer_name == null ? "Silinmiş kullanıcı" : String(r.reviewer_name),
        at: asIso(r.created_at),
      });

/** One page of a seller's reviews, for "Daha fazla göster". */
export const getSellerReviews = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), offset: z.number().int().min(0).max(100_000) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select r.*, pr.display_name as reviewer_name
       from reviews r left join profiles pr on pr.user_id = r.reviewer_id
       where r.seller_id=$1 order by r.created_at desc limit 20 offset $2`,
      [data.id, data.offset],
    );
    return rows.map(mapReview);
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
    const [reviews, store, responseStats] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select r.*, pr.display_name as reviewer_name
         from reviews r left join profiles pr on pr.user_id = r.reviewer_id
         where r.seller_id=$1 order by r.created_at desc limit 20`,
        [data.id],
      ),
      sql.query<Record<string, unknown>>("select * from stores where user_id=$1 limit 1", [data.id]),
      getSellerResponseStats(sql, data.id),
    ]);
    const sellerPrefs = resolveUserPrefs(asJson(p[0].user_prefs, {})).seller_prefs;
    return {
      id: String(p[0].user_id),
      name: String(p[0].display_name ?? "Satıcı"),
      city: p[0].city ? String(p[0].city) : null,
      bio: p[0].bio ? String(p[0].bio) : null,
      avatar: p[0].avatar_url ? String(p[0].avatar_url) : null,
      since: asIso(p[0].created_at),
      listing_count: num(p[0].listing_count),
      rating_avg: num(p[0].rating_avg),
      rating_count: num(p[0].rating_count),
      responseStats,
      availability: {
        callHours: sellerPrefs.call_hours_enabled ? `${sellerPrefs.call_hours_start} – ${sellerPrefs.call_hours_end}` : null,
        awayMode: sellerPrefs.away_mode,
        awayMessage: sellerPrefs.away_mode
          ? sellerPrefs.away_message || "Satıcı şu an müsait değil, mesajlarınıza en kısa sürede dönüş yapacaktır."
          : null,
        acceptOffers: sellerPrefs.accept_offers,
      },
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
      reviews: reviews.map(mapReview),
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
      plan: String(rows[0].plan),
    };
  });

export const getCategoryAttrs = createServerFn({ method: "POST" })
  .validator(z.object({ categoryId: z.string() }))
  .handler(async ({ data }) => inheritedAttributes(data.categoryId));

export const getSubtree = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => subtreeIds(data.slug));

const StoreApplicationInput = z.object({
  name: z.string().trim().min(3, "Mağaza adı en az 3 karakter olmalı.").max(60),
  businessType: z.enum(["SOLE", "COMPANY"]),
  sector: z.string().trim().min(2, "Faaliyet alanı seçin.").max(60),
  taxNo: z.string().trim().min(10, "Vergi veya T.C. kimlik numarası girin.").max(20),
  taxOffice: z.string().trim().min(2, "Vergi dairesi girin.").max(80),
  city: z.string().trim().min(2, "İl seçin.").max(40),
  phone: z.string().trim().min(10, "Geçerli bir işletme telefonu girin.").max(20),
  address: z.string().trim().min(10, "Açık işletme adresi en az 10 karakter olmalı.").max(300),
  notes: z.string().trim().max(1000).optional(),
});

export type StoreApplicationRow = {
  id: string;
  name: string;
  business_type: BusinessType | null;
  sector: string | null;
  tax_office: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  tax_no: string | null;
  notes: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  cooldown_until: string | null;
};

function computeCooldownUntil(status: string, reviewedAt: unknown, createdAt: unknown): string | null {
  if (status !== "REJECTED") return null;
  const baseIso = reviewedAt ? asIso(reviewedAt) : asIso(createdAt);
  const ts = Date.parse(baseIso);
  if (!Number.isFinite(ts)) return null;
  const end = ts + STORE_APP_COOLDOWN_DAYS * 86_400_000;
  return end > Date.now() ? new Date(end).toISOString() : null;
}

function mapStoreApplication(r: Record<string, unknown>): StoreApplicationRow {
  const status = String(r.status);
  const bt = r.business_type === "SOLE" || r.business_type === "COMPANY" ? r.business_type : null;
  return {
    id: String(r.id),
    name: String(r.name),
    business_type: bt,
    sector: r.sector ? String(r.sector) : null,
    tax_office: r.tax_office ? String(r.tax_office) : null,
    address: r.address ? String(r.address) : null,
    city: r.city ? String(r.city) : null,
    phone: r.phone ? String(r.phone) : null,
    tax_no: r.tax_no ? String(r.tax_no) : null,
    notes: r.notes ? String(r.notes) : null,
    status,
    review_note: r.review_note ? String(r.review_note) : null,
    created_at: asIso(r.created_at),
    reviewed_at: r.reviewed_at ? asIso(r.reviewed_at) : null,
    cooldown_until: computeCooldownUntil(status, r.reviewed_at, r.created_at),
  };
}

/** Submit a store opening application for the signed-in user. */
export async function submitStoreApplicationRecord(
  sql: Pick<Sql, "query">,
  userId: string,
  data: z.infer<typeof StoreApplicationInput>,
): Promise<StoreApplicationRow> {
  rateLimit(`store-app:${userId}`, 5, 60 * 60_000);
  await ensureProfile(userId);
  const normalizedTaxNo = normalizeAndValidateTaxNo(data.taxNo, data.businessType);
  const phone = normalizeTrPhone(data.phone);

  const authRows = await sql
    .query<{ emailVerified: boolean }>('select "emailVerified" from "user" where id=$1 limit 1', [userId])
    .catch(() => []);
  if (authRows[0] && !authRows[0].emailVerified) {
    throw new Error("Kurumsal hesap başvurusu için önce e-posta adresinizi doğrulayın.");
  }

  const existingStore = await sql.query<{ id: string }>("select id from stores where user_id=$1 limit 1", [userId]);
  if (existingStore[0]) throw new Error("Zaten bir kurumsal mağazanız var.");
  const pendingApp = await sql.query<{ id: string }>(
    "select id from store_applications where user_id=$1 and status='PENDING' limit 1",
    [userId],
  );
  if (pendingApp[0]) throw new Error("Zaten inceleme bekleyen bir kurumsal başvurunuz var.");

  const rejectedApp = await sql.query<{ reviewed_at: unknown; created_at: unknown }>(
    "select reviewed_at, created_at from store_applications where user_id=$1 and status='REJECTED' order by created_at desc limit 1",
    [userId],
  );
  if (rejectedApp[0]) {
    const cooldownUntil = computeCooldownUntil("REJECTED", rejectedApp[0].reviewed_at, rejectedApp[0].created_at);
    if (cooldownUntil) {
      const remainingDays = Math.max(1, Math.ceil((Date.parse(cooldownUntil) - Date.now()) / 86_400_000));
      throw new Error(`Önceki başvurunuz reddedildi. ${remainingDays} gün sonra yeniden başvurabilirsiniz.`);
    }
  }

  const rows = await sql.query<Record<string, unknown>>(
    `insert into store_applications (id, user_id, name, business_type, sector, tax_office, address, city, phone, tax_no, notes, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING')
     returning id, name, business_type, sector, tax_office, address, city, phone, tax_no, notes, status, review_note, created_at, reviewed_at`,
    [
      newId("sapp"),
      userId,
      data.name,
      data.businessType,
      data.sector,
      data.taxOffice,
      data.address,
      data.city,
      phone,
      normalizedTaxNo,
      data.notes || null,
    ],
  );
  return mapStoreApplication(rows[0]);
}

/** Return the latest store application for `userId`, or null. */
export async function myStoreApplicationRecord(
  sql: Pick<Sql, "query">,
  userId: string,
): Promise<StoreApplicationRow | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `select id, name, business_type, sector, tax_office, address, city, phone, tax_no, notes, status, review_note, created_at, reviewed_at
     from store_applications where user_id=$1 order by created_at desc limit 1`,
    [userId],
  );
  return rows[0] ? mapStoreApplication(rows[0]) : null;
}

export const submitStoreApplication = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(StoreApplicationInput)
  .handler(async ({ context, data }) => submitStoreApplicationRecord(await getSql(), context.userId, data));

export const myStoreApplication = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => myStoreApplicationRecord(await getSql(), context.userId));

const BulkImportRowInput = z.object({
  title: z.string().trim().min(5, "Başlık en az 5 karakter olmalı.").max(100),
  description: z.string().trim().min(10, "Açıklama en az 10 karakter olmalı.").max(5000),
  price: z.number().min(1, "Fiyat en az 1 olmalı.").max(1_000_000_000),
  currency: z.enum(["TRY", "USD", "EUR"]).optional(),
  categorySlug: z.string().trim().min(1, "Kategori gerekli.").max(120),
  city: z.string().trim().min(1, "Şehir gerekli.").max(60),
  district: z.string().trim().min(1, "İlçe gerekli.").max(60),
  neighborhood: z.string().trim().max(60).optional(),
});

/** Bulk import up to 50 listings for an existing store owner inside a single transaction. */
export async function bulkImportListingsRecord(
  sql: Sql,
  userId: string,
  rawRows: unknown[],
): Promise<{ imported: number; errors: Array<{ index: number; error: string }> }> {
  rateLimit(`bulk-import:${userId}`, 10, 60 * 60_000);
  if (rawRows.length > 50) throw new Error("Tek seferde en fazla 50 ilan yükleyebilirsiniz.");
  const me = await ensureProfile(userId);
  await assertNotClosing(sql, userId);

  const stores = await sql.query<{ id: string; phone: string | null }>("select id, phone from stores where user_id=$1 limit 1", [userId]);
  const storeId = stores[0]?.id;
  if (!storeId) throw new Error("Toplu ilan yüklemek için mağazanız olmalıdır.");

  const profPhone = await sql.query<{ phone: string | null }>("select phone from profiles where user_id=$1", [userId]);
  if (!profPhone[0]?.phone && !stores[0]?.phone) throw new Error("İlan vermek için profilinize telefon ekleyin.");

  const tree = await getCategoryTree();
  const catBySlug = new Map<string, { id: string; slug: string }>();
  for (const c of tree.byId.values()) catBySlug.set(c.slug.toLowerCase(), { id: c.id, slug: c.slug });

  const validCitySet = new Set<string>(TURKEY_CITIES.map((c) => c.name));
  const errors: Array<{ index: number; error: string }> = [];
  const validRows: Array<z.infer<typeof BulkImportRowInput> & { categoryId: string; categorySlug: string }> = [];

  for (let index = 0; index < rawRows.length; index++) {
    const parsed = BulkImportRowInput.safeParse(rawRows[index]);
    if (!parsed.success) {
      errors.push({ index, error: parsed.error.issues[0]?.message ?? "Geçersiz satır." });
      continue;
    }
    if (!validCitySet.has(parsed.data.city)) {
      errors.push({ index, error: `Geçersiz şehir: ${parsed.data.city}` });
      continue;
    }
    const cat = catBySlug.get(parsed.data.categorySlug.toLowerCase());
    if (!cat) {
      errors.push({ index, error: `Kategori bulunamadı: ${parsed.data.categorySlug}` });
      continue;
    }
    // Check root category for mandatory photo rules (emlak / vasita)
    let curId: string | null = cat.id;
    let needsPhoto = false;
    while (curId) {
      if (curId === "emlak" || curId === "vasita") {
        needsPhoto = true;
        break;
      }
      curId = tree.byId.get(curId)?.parent_id ?? null;
    }
    if (needsPhoto) {
      errors.push({ index, error: "Emlak ve vasıta ilanları en az 1 fotoğraf gerektirdiğinden toplu yüklenemez." });
      continue;
    }
    const attrRules = await inheritedAttributes(cat.id);
    if (attrRules.some((a) => a.required)) {
      errors.push({ index, error: "Zorunlu kategori özellikleri içeren ilanlar toplu yüklenemez." });
      continue;
    }
    validRows.push({ ...parsed.data, categoryId: cat.id, categorySlug: cat.slug });
  }

  if (!validRows.length) return { imported: 0, errors };

  const { mode } = await getAppConfig<{ mode: "first_free" | "all" | "none" }>("moderation", { mode: "first_free" });
  const isAdmin = isActiveAdmin(me);

  const inserted = await sql.transaction(async (tx) => {
    let firstClaimed = false;
    if (!isAdmin && mode === "first_free") {
      firstClaimed = Boolean(
        (await tx.query("update profiles set first_listing_used=true where user_id=$1 and not first_listing_used returning user_id", [userId]))[0],
      );
    }
    const created: Array<{
      id: string;
      slug: string;
      status: string;
      title: string;
      categoryId: string;
      categorySlug: string;
      city: string;
      district: string;
      neighborhood: string | null;
      price: number;
    }> = [];
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const status = isAdmin || mode === "none" || (firstClaimed && i === 0) ? "ACTIVE" : "PENDING";
      const id = newId("lst");
      const listingNo = (await tx.query<{ n: string }>("select nextval('listing_no_seq')::text as n"))[0].n;
      const slug = listingSlug(row.title, listingNo);
      const currency = row.currency ?? "TRY";

      await tx.query(
        `insert into listings (id,slug,user_id,store_id,category_id,title,description,price,currency,status,city,district,
          neighborhood,lat,lng,images,attrs,expires_at,approved_at,listing_no)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,null,null,'[]'::jsonb,'{}'::jsonb,now()+interval '30 days',
           case when $10::text = 'ACTIVE' then now() end,$14::bigint)`,
        [
          id,
          slug,
          userId,
          storeId,
          row.categoryId,
          row.title,
          row.description,
          row.price,
          currency,
          status,
          row.city,
          row.district,
          row.neighborhood || null,
          listingNo,
        ],
      );
      await tx.query("insert into price_history (listing_id,price) values ($1,$2)", [id, row.price]);
      created.push({
        id,
        slug,
        status,
        title: row.title,
        categoryId: row.categoryId,
        categorySlug: row.categorySlug,
        city: row.city,
        district: row.district,
        neighborhood: row.neighborhood || null,
        price: row.price,
      });
    }
    return created;
  });

  const sellerName = me.display_name || "Satıcı";
  for (const item of inserted) {
    if (item.status !== "ACTIVE") continue;
    void notifyMatchingSavedSearches(sql, {
      id: item.id,
      title: item.title,
      slug: item.slug,
      categoryId: item.categoryId,
      categorySlug: item.categorySlug,
      city: item.city,
      district: item.district,
      neighborhood: item.neighborhood,
      price: item.price,
      userId,
      hasImages: false,
      isStore: true,
      attrs: {},
    }).catch((err) => console.warn("[saved-searches] bulk notify failed", err));
    void notifySellerFollowers(sql, {
      id: item.id,
      title: item.title,
      slug: item.slug,
      userId,
      sellerName,
    }).catch((err) => console.warn("[follows] bulk notify failed", err));
  }

  return { imported: inserted.length, errors };
}

export const bulkImportListings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ rows: z.array(z.unknown()).min(1).max(50) }))
  .handler(async ({ context, data }) => {
    const flags = await resolveFlags({ userId: context.userId, anonId: null, platform: "web" });
    if (!flags.toplu_ilan_aktarim) throw new Error("Toplu ilan aktarımı şu anda kullanıma kapalı.");
    return bulkImportListingsRecord(await getSql(), context.userId, data.rows);
  });

export const quickUpdatePrice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1), price: z.number().finite().positive().max(1_000_000_000) }))
  .handler(async ({ context, data }) => {
    rateLimit(`price-update:${context.userId}`, 30, 60_000);
    const sql = await getSql();
    const me = await ensureProfile(context.userId);
    const isAdmin = isActiveAdmin(me);
    const newPrice = Math.max(1, Math.round(data.price));

    const res = await sql.transaction(async (tx) => {
      const rows = await tx.query<{
        user_id: string;
        status: string;
        price: number;
        currency: string;
        title: string;
        slug: string;
      }>("select user_id, status, price, currency, title, slug from listings where id=$1 for update", [data.id]);
      const cur = rows[0];
      if (!cur) throw new Error("İlan bulunamadı.");
      if (cur.user_id !== context.userId && !isAdmin) throw new Error("Yetkisiz işlem.");
      if (cur.status === "SOLD") throw new Error("Satılmış ilanın fiyatı güncellenemez.");
      const prevPrice = num(cur.price);
      if (newPrice !== prevPrice) {
        await tx.query("update listings set price=$2, updated_at=now() where id=$1", [data.id, newPrice]);
        await tx.query("insert into price_history (listing_id, price) values ($1, $2)", [data.id, newPrice]);
      }
      return {
        ownerId: cur.user_id,
        status: cur.status,
        prevPrice,
        currency: cur.currency || "TRY",
        title: cur.title,
        slug: cur.slug,
      };
    });

    if (res.status === "ACTIVE" && newPrice < res.prevPrice) {
      void sql
        .query<{ user_id: string }>(
          "select user_id from favorites where listing_id=$1 and user_id<>$2 limit 500",
          [data.id, res.ownerId],
        )
        .then((favs) =>
          Promise.allSettled(
            favs.map(({ user_id: uid }) =>
              notify(
                uid,
                "favorite",
                "Favori ilanınızda fiyat düştü",
                `${res.title} — ${formatPrice(newPrice, res.currency)}`,
                `/ilan/${res.slug}`,
              ),
            ),
          ),
        )
        .catch((err) => console.warn("[account] quick price drop notify failed", err));
    }

    return { ok: true, price: newPrice, previousPrice: res.prevPrice };
  });

