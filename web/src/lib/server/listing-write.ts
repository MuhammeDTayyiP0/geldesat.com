import { z } from "zod";
import { getSql } from "@/lib/db";
import { CITY_COORDS } from "@/lib/data/geo";
import { asJson, listingSlug, newId, num } from "@/lib/utils";
import { inheritedAttributes, ensureProfile, rateLimit, assertImages, notify, normalizeTrPhone } from "./helpers";
import { deleteUnusedListingImages } from "./upload.server";
import { getAppConfig } from "./config";

export const ListingInput = z.object({
  id: z.string().optional(),
  categoryId: z.string(),
  title: z.string().min(5).max(100),
  description: z.string().min(10).max(5000),
  price: z.number().min(1).max(1_000_000_000),
  city: z.string().min(1),
  district: z.string().min(1),
  neighborhood: z.string().max(60).optional(),
  phone: z.string().max(20).optional(),
  images: z.array(z.string()).max(10),
  attrs: z.record(z.string(), z.union([z.string(), z.number()])),
  storeId: z.string().optional(),
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

/** Status after an owner renews: only an approved listing may go back live. */
export function renewedStatus(status: string, approvedAt: string | null): string {
  if (status === "SOLD" || status === "PENDING") return status;
  return approvedAt ? "ACTIVE" : "PENDING";
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
  const phoneOverride = data.phone?.trim() ? normalizeTrPhone(data.phone) : null;
  const isAdmin = profile[0]?.role === "ADMIN";
  // Admin console policy: first_free (first listing goes live), all (everything is reviewed), none (no review).
  const { mode } = await getAppConfig<{ mode: "first_free" | "all" | "none" }>("moderation", { mode: "first_free" });
  const existing = data.id
    ? (
        await sql.query<{
          user_id: string; slug: string; listing_no: string | number; price: string | number; status: string; images: unknown;
          title: string; description: string; category_id: string;
        }>("select user_id, slug, listing_no, price, status, images, title, description, category_id from listings where id = $1", [data.id])
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
    const owned = await sql.query<{ n: number }>(
      "select count(*)::int as n from mobile_listing_images where user_id=$1 and (id=any($2::text[]) or storage_key=any($3::text[]))",
      [ownerId, ids, keys],
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
  const cat = await sql.query<{ id: string }>("select id from categories where id = $1", [data.categoryId]);
  if (!cat[0]) throw new Error("Kategori bulunamadı");
  for (const attr of (await inheritedAttributes(data.categoryId)).filter((item) => item.required)) {
    const value = data.attrs[attr.name];
    if (value == null || value === "") throw new Error(`Zorunlu alan: ${attr.name}`);
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
    // An owner changing what the listing shows sends it back to moderation, so
    // an approved listing cannot be swapped for different content afterwards.
    const contentChanged =
      existing.title !== data.title ||
      existing.description !== data.description ||
      existing.category_id !== data.categoryId ||
      added.length > 0;
    const reReview = !isAdmin && mode !== "none" && contentChanged && (existing.status === "ACTIVE" || existing.status === "INACTIVE");
    const nextStatus = existing.status === "REJECTED" || reReview ? "PENDING" : existing.status;
    // The URL follows the title; old links still resolve by the trailing listing number.
    const slug = listingSlug(data.title, existing.listing_no);
    await sql.query(
      `update listings set category_id=$2,title=$3,description=$4,price=$5,city=$6,district=$7,
        neighborhood=$8,lat=$9,lng=$10,images=$11::jsonb,attrs=$12::jsonb,phone_override=$13,
        store_id=$14,status=$15,approved_at=case when $16::boolean then null else approved_at end,
        slug=$17,updated_at=now() where id=$1`,
      [data.id,data.categoryId,data.title,data.description,data.price,data.city,data.district,data.neighborhood || null,
        coords?.lat ?? null,coords?.lng ?? null,JSON.stringify(data.images),JSON.stringify(data.attrs),
        phoneOverride,data.storeId || null,nextStatus,reReview,slug],
    );
    await deleteUnusedListingImages(sql, ownerId, existingImages.filter((image) => !data.images.includes(image)));
    if (num(existing.price) !== data.price) await sql.query("insert into price_history (listing_id,price) values ($1,$2)", [data.id,data.price]);
    if (existing.status === "REJECTED" || reReview) {
      await notify(ownerId,"listing","İlanınız tekrar incelemede","Düzenlenen ilan onay kuyruğuna alındı.",`/ilan/${slug}`);
    }
    return { id: data.id, slug, status: nextStatus };
  }

  await assertStoreOwner(userId);
  const id = newId("lst");
  const listingNo = (await sql.query<{ n: string }>("select nextval('listing_no_seq')::text as n"))[0].n;
  const slug = listingSlug(data.title, listingNo);
  const prior = await sql.query<{ n: number }>("select count(*)::int as n from listings where user_id=$1", [userId]);
  const autoApprove = isAdmin || mode === "none" || (mode === "first_free" && (prior[0]?.n ?? 0) === 0);
  const status = autoApprove ? "ACTIVE" : "PENDING";
  await sql.query(
    `insert into listings (id,slug,user_id,store_id,category_id,title,description,price,status,city,district,
      neighborhood,lat,lng,images,attrs,phone_override,expires_at,approved_at,listing_no)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,now()+interval '30 days',
       case when $9::text = 'ACTIVE' then now() end,$18::bigint)`,
    [id,slug,userId,data.storeId || null,data.categoryId,data.title,data.description,data.price,status,data.city,data.district,
      data.neighborhood || null,coords?.lat ?? null,coords?.lng ?? null,JSON.stringify(data.images),JSON.stringify(data.attrs),phoneOverride,listingNo],
  );
  await sql.query("insert into price_history (listing_id,price) values ($1,$2)", [id,data.price]);
  return { id, slug, status };
}
