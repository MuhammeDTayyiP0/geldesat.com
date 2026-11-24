import { z } from "zod";
import { getSql } from "@/lib/db";
import { CITY_COORDS } from "@/lib/data/geo";
import { cleanAttrs, type AttrValues } from "@/lib/listing-attrs";
import { needsReReview, sameAttrs } from "@/lib/listing-status";
import { asJson, formatPrice, listingSlug, newId, num } from "@/lib/utils";
import { inheritedAttributes, ensureProfile, rateLimit, assertImages, notify, normalizeTrPhone } from "./helpers";
import { deleteUnusedListingImages } from "./upload.server";
import { getAppConfig } from "./config";
import { audit } from "./admin/common";
import { notifySellerFollowers } from "./follows";
import { notifyMatchingSavedSearches } from "./saved-searches";

export const ListingInput = z.object({
  id: z.string().optional(),
  categoryId: z.string(),
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(10).max(5000),
  price: z.number().min(1).max(1_000_000_000),
  currency: z.enum(["TRY", "USD", "EUR"]).optional(),
  city: z.string().min(1).max(60),
  district: z.string().min(1).max(60),
  neighborhood: z.string().max(60).optional(),
  phone: z.string().max(20).optional(),
  images: z.array(z.string()).max(10),
  attrs: z.record(z.string(), z.union([z.string(), z.number()])),
  storeId: z.string().optional(),
  /** New listings only: the same key twice returns the listing created the first time. */
  clientKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
});

export type ListingInputData = z.infer<typeof ListingInput>;

/** Listings stay hidden while their owner's account waits for deletion. */
export async function assertNotClosing(sql: Pick<Awaited<ReturnType<typeof getSql>>, "query">, userId: string) {
  const rows = await sql.query<{ pending: boolean }>(
    "select deletion_requested_at is not null as pending from profiles where user_id=$1",
    [userId],
  );
  if (rows[0]?.pending) throw new Error("Hesabınız silinme sürecinde. Önce hesabınızı geri alın.");
}

/** Shared write path for web server functions and the native mobile API. */
export async function saveListingRecord(userId: string, data: ListingInputData) {
  rateLimit(`listing:${userId}`, 20, 60_000);
  const sql = await getSql();
  const me = await ensureProfile(userId);
  if (!me) throw new Error("Profil yok");
  const profile = await sql.query<{ phone: string | null; role: string; deletion_requested_at: string | null }>(
    "select phone, role, deletion_requested_at from profiles where user_id = $1",
    [userId],
  );
  if (profile[0]?.deletion_requested_at) throw new Error("Hesabınız silinme sürecinde. İlan vermek için önce hesabınızı geri alın.");
  if (!profile[0]?.phone && !data.phone) throw new Error("İlan vermek için profilinize telefon ekleyin.");
  // Only an explicit per-listing number is stored; otherwise the listing shows
  // the seller's current profile phone (revealPhone falls back to it).
  const typedPhone = data.phone?.trim() ? normalizeTrPhone(data.phone) : null;
  // The form starts filled with the profile number; that is not a choice to keep
  // it forever, so listings follow the profile when it changes.
  const phoneOverride = typedPhone && typedPhone !== profile[0]?.phone ? typedPhone : null;
  const isAdmin = profile[0]?.role === "ADMIN";
  // Admin console policy: first_free (first listing goes live), all (everything is reviewed), none (no review).
  const { mode } = await getAppConfig<{ mode: "first_free" | "all" | "none" }>("moderation", { mode: "first_free" });
  const existing = data.id
    ? (
        await sql.query<{
          user_id: string; slug: string; listing_no: string | number; price: string | number; status: string; images: unknown;
          title: string; description: string; category_id: string; attrs: unknown; currency: string | null;
        }>("select user_id, slug, listing_no, price, status, images, title, description, category_id, attrs, currency from listings where id = $1", [data.id])
      )[0]
    : undefined;
  if (data.id && !existing) throw new Error("İlan bulunamadı");
  if (existing && existing.user_id !== userId && !isAdmin) throw new Error("Yetkisiz işlem");
  const ownerId = existing?.user_id ?? userId;
  const existingImages = asJson<string[]>(existing?.images, []);

  assertImages(data.images, existingImages);
  // Newly added photos must be the owner's own uploads.
  const added = data.images.filter((image) => !existingImages.includes(image));
  const ids = added.flatMap((image) => image.match(/^\/api\/mobile\/images\/([0-9a-f-]{36})$/i)?.[1] ?? []);
  const keys = added.flatMap((image) => image.match(/^\/uploads\/([^/]+)$/)?.[1] ?? []);
  if (ids.length || keys.length) {
    const allowedOwners = isAdmin && ownerId !== userId ? [ownerId, userId] : [ownerId];
    const owned = await sql.query<{ n: number }>(
      "select count(*)::int as n from mobile_listing_images where user_id = any($1::text[]) and (id=any($2::text[]) or storage_key=any($3::text[]))",
      [allowedOwners, ids, keys],
    );
    if ((owned[0]?.n ?? 0) !== new Set([...ids, ...keys]).size) {
      throw new Error("Fotoğraflarınızdan biri bulunamadı. Lütfen yeniden yükleyin.");
    }
  }

  const photoNeed = await sql.query<{ id: string }>(
    `with recursive chain as (
       select id, parent_id from categories where id = $1
       union all
       select c.id, c.parent_id from categories c join chain ch on ch.parent_id = c.id
     ) select id from chain where id in ('emlak','vasita')`,
    [data.categoryId],
  );
  if (photoNeed.length && !data.images.length) throw new Error("Emlak ve vasıta ilanlarında en az 1 fotoğraf zorunludur.");
  const cat = await sql.query<{ id: string; slug: string }>("select id, slug from categories where id = $1", [data.categoryId]);
  if (!cat[0]) throw new Error("Kategori bulunamadı");
  const attrRules = await inheritedAttributes(data.categoryId);
  const attrs = cleanAttrs(data.attrs, attrRules, asJson<AttrValues>(existing?.attrs, {}));
  for (const attr of attrRules.filter((item) => item.required)) {
    if (attrs[attr.name] == null) throw new Error(`Zorunlu alan: ${attr.name}`);
  }

  // A listing may only be attached to a store owned by the listing's owner.
  const assertStoreOwner = async (ownerId: string) => {
    if (!data.storeId) return;
    const store = await sql.query<{ id: string }>("select id from stores where id=$1 and user_id=$2", [data.storeId, ownerId]);
    if (!store[0]) throw new Error("Mağaza bulunamadı");
  };

  const coords = CITY_COORDS[data.city];
  if (data.id && existing) {
    await assertStoreOwner(ownerId);
    const txResult = await sql.transaction(async (tx) => {
      const lockedRows = await tx.query<{
        user_id: string; slug: string; listing_no: string | number; price: string | number; status: string; images: unknown;
        title: string; description: string; category_id: string; attrs: unknown; currency: string | null;
      }>(
        "select user_id, slug, listing_no, price, status, images, title, description, category_id, attrs, currency from listings where id = $1 for update",
        [data.id],
      );
      const locked = lockedRows[0];
      if (!locked) throw new Error("İlan bulunamadı");
      const lockedImages = asJson<string[]>(locked.images, []);
      const lockedAdded = data.images.filter((image) => !lockedImages.includes(image));
      // An owner changing what the listing shows sends it back to moderation, so
      // an approved listing cannot be swapped for different content afterwards.
      const contentChanged =
        locked.title !== data.title ||
        locked.description !== data.description ||
        locked.category_id !== data.categoryId ||
        lockedAdded.length > 0 ||
        !sameAttrs(attrs, asJson<AttrValues>(locked.attrs, {}));
      const reReview = !isAdmin && mode !== "none" && contentChanged && needsReReview(locked.status);
      const nextStatus = locked.status === "REJECTED" || reReview ? "PENDING" : locked.status;
      const clearRejection = nextStatus === "PENDING" || nextStatus === "ACTIVE";
      const nextCurrency = data.currency ?? locked.currency ?? "TRY";
      // The URL follows the title; old links still resolve by the trailing listing number.
      const slug = listingSlug(data.title, locked.listing_no);
      await tx.query(
        `update listings set category_id=$2,title=$3,description=$4,price=$5,city=$6,district=$7,
          neighborhood=$8,lat=$9,lng=$10,images=$11::jsonb,attrs=$12::jsonb,phone_override=$13,
          store_id=$14,status=$15,approved_at=case when $16::boolean then null else approved_at end,
          status_before_ban=null,slug=$17,currency=$18,
          rejection_reason=case when $19::boolean then null else rejection_reason end,
          updated_at=now() where id=$1`,
        [data.id, data.categoryId, data.title, data.description, data.price, data.city, data.district, data.neighborhood || null,
          coords?.lat ?? null, coords?.lng ?? null, JSON.stringify(data.images), JSON.stringify(attrs),
          phoneOverride, data.storeId || null, nextStatus, reReview, slug, nextCurrency, clearRejection],
      );
      if (num(locked.price) !== data.price) await tx.query("insert into price_history (listing_id,price) values ($1,$2)", [data.id, data.price]);
      return {
        slug,
        nextStatus,
        reReview,
        prevStatus: locked.status,
        prevPrice: num(locked.price),
        listingNo: locked.listing_no,
        userId: locked.user_id,
        nextCurrency,
      };
    });
    await deleteUnusedListingImages(sql, ownerId, existingImages.filter((image) => !data.images.includes(image)));
    if (isAdmin && txResult.userId !== userId) {
      await audit(sql, userId, "listing.edit", "listing", data.id, `#${txResult.listingNo} "${data.title}" site üzerinden düzenlendi`, { from: txResult.prevStatus, to: txResult.nextStatus });
    }
    if (txResult.prevStatus === "REJECTED" || txResult.reReview) {
      await notify(ownerId, "listing", "İlanınız tekrar incelemede", "Düzenlenen ilan onay kuyruğuna alındı.", `/ilan/${txResult.slug}`);
    }
    if (txResult.prevStatus === "ACTIVE" && txResult.nextStatus === "ACTIVE" && data.price < txResult.prevPrice) {
      void sql
        .query<{ user_id: string }>(
          "select user_id from favorites where listing_id=$1 and user_id<>$2 limit 500",
          [data.id, ownerId],
        )
        .then((favs) =>
          Promise.allSettled(
            favs.map(({ user_id: uid }) =>
              notify(
                uid,
                "favorite",
                "Favori ilanınızda fiyat düştü",
                `${data.title} — ${formatPrice(data.price, txResult.nextCurrency)}`,
                `/ilan/${txResult.slug}`,
              ),
            ),
          ),
        )
        .catch((err) => console.warn("[listing-write] price drop notify failed", err));
    }
    return { id: data.id, slug: txResult.slug, status: txResult.nextStatus };
  }

  await assertStoreOwner(userId);
  const sent = async () =>
    data.clientKey
      ? (await sql.query<{ id: string; slug: string; status: string }>(
          "select id, slug, status from listings where user_id=$1 and client_key=$2",
          [userId, data.clientKey],
        ))[0]
      : undefined;
  const already = await sent();
  if (already) return already;
  const id = newId("lst");
  const listingNo = (await sql.query<{ n: string }>("select nextval('listing_no_seq')::text as n"))[0].n;
  const slug = listingSlug(data.title, listingNo);
  const currency = data.currency ?? "TRY";
  const status = await sql.transaction(async (tx) => {
    // Claimed in one statement, so two listings sent together cannot both be "the first".
    const claimedFirst =
      mode === "first_free" &&
      Boolean((await tx.query("update profiles set first_listing_used=true where user_id=$1 and not first_listing_used returning user_id", [userId]))[0]);
    const next = isAdmin || mode === "none" || claimedFirst ? "ACTIVE" : "PENDING";
    await tx.query(
      `insert into listings (id,slug,user_id,store_id,category_id,title,description,price,currency,status,city,district,
        neighborhood,lat,lng,images,attrs,phone_override,expires_at,approved_at,listing_no,client_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18,now()+interval '30 days',
         case when $10::text = 'ACTIVE' then now() end,$19::bigint,$20)`,
      [id, slug, userId, data.storeId || null, data.categoryId, data.title, data.description, data.price, currency, next, data.city, data.district,
        data.neighborhood || null, coords?.lat ?? null, coords?.lng ?? null, JSON.stringify(data.images), JSON.stringify(attrs), phoneOverride, listingNo,
        data.clientKey ?? null],
    );
    await tx.query("insert into price_history (listing_id,price) values ($1,$2)", [id, data.price]);
    return next;
  }).catch(async (error: unknown) => {
    // Lost the race to an identical request: answer with the listing that one created.
    if ((error as { code?: string }).code === "23505" && data.clientKey) {
      const winner = await sent();
      if (winner) return { winner };
    }
    throw error;
  });
  if (typeof status === "object") return status.winner;
  if (status === "ACTIVE") {
    void notifyMatchingSavedSearches(sql, {
      id,
      title: data.title,
      slug,
      userId,
      categorySlug: cat[0].slug,
      city: data.city || null,
      district: data.district || null,
      price: data.price,
    }).catch((err) => console.warn("[saved-searches] notify failed", err));
    void notifySellerFollowers(sql, {
      id,
      title: data.title,
      slug,
      userId,
      sellerName: me.display_name || "Satıcı",
    }).catch((err) => console.warn("[follows] notify failed", err));
  }
  return { id, slug, status };
}
