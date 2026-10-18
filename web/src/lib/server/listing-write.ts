import { z } from "zod";
import { getSql } from "@/lib/db";
import { CITY_COORDS } from "@/lib/data/geo";
import { newId, num, slugify } from "@/lib/utils";
import { inheritedAttributes, ensureProfile, rateLimit, assertImages, notify, normalizeTrPhone } from "./helpers";
import { notifySearchHits } from "./ops";
import { deleteUnusedListingImages } from "./upload.server";

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
  const profile = await sql.query<{ phone: string | null; role: string }>(
    "select phone, role from profiles where user_id = $1",
    [userId],
  );
  if (!profile[0]?.phone && !data.phone) throw new Error("İlan vermek için profilinize telefon ekleyin.");
  const phone = data.phone?.trim() ? normalizeTrPhone(data.phone) : profile[0]?.phone;
  if (phone) normalizeTrPhone(phone);
  assertImages(data.images);
  const mobileImageIds = data.images.flatMap((image) => {
    const match = image.match(/^\/api\/mobile\/images\/([0-9a-f-]{36})$/i);
    return match ? [match[1]] : [];
  });
  if (mobileImageIds.length) {
    const owned = await sql.query<{ id: string }>(
      "select id from mobile_listing_images where user_id=$1 and id=any($2::text[])",
      [userId, mobileImageIds],
    );
    if (owned.length !== new Set(mobileImageIds).size) throw new Error("Fotoğraflarınızdan biri bulunamadı. Lütfen yeniden yükleyin.");
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
  const slugBase = slugify(data.title) || "ilan";
  if (data.id) {
    const existing = await sql.query<{ user_id: string; slug: string; price: string | number; status: string; images: string[] }>(
      "select user_id, slug, price, status, images from listings where id = $1", [data.id],
    );
    if (!existing[0]) throw new Error("İlan bulunamadı");
    if (existing[0].user_id !== userId && profile[0]?.role !== "ADMIN") throw new Error("Yetkisiz işlem");
    await assertStoreOwner(existing[0].user_id);
    const nextStatus = existing[0].status === "REJECTED" ? "PENDING" : existing[0].status;
    await sql.query(
      `update listings set category_id=$2,title=$3,description=$4,price=$5,city=$6,district=$7,
        neighborhood=$8,lat=$9,lng=$10,images=$11::jsonb,attrs=$12::jsonb,phone_override=$13,
        store_id=$14,status=$15,updated_at=now() where id=$1`,
      [data.id,data.categoryId,data.title,data.description,data.price,data.city,data.district,data.neighborhood || null,
        coords?.lat ?? null,coords?.lng ?? null,JSON.stringify(data.images),JSON.stringify(data.attrs),
        data.phone?.trim() ? normalizeTrPhone(data.phone) : null,data.storeId || null,nextStatus],
    );
    await deleteUnusedListingImages(sql, userId, (existing[0].images || []).filter((image) => !data.images.includes(image)));
    if (num(existing[0].price) !== data.price) await sql.query("insert into price_history (listing_id,price) values ($1,$2)", [data.id,data.price]);
    if (existing[0].status === "REJECTED") {
      await notify(userId,"listing","İlanınız tekrar incelemede","Düzenlenen ilan onay kuyruğuna alındı.",`/ilan/${existing[0].slug}`);
    }
    return { id: data.id, slug: existing[0].slug, status: nextStatus };
  }

  await assertStoreOwner(userId);
  const id = newId("lst");
  const slug = `${slugBase}-${id.slice(-6)}`;
  const prior = await sql.query<{ n: number }>("select count(*)::int as n from listings where user_id=$1", [userId]);
  const status = profile[0]?.role === "ADMIN" || (prior[0]?.n ?? 0) === 0 ? "ACTIVE" : "PENDING";
  await sql.query(
    `insert into listings (id,slug,user_id,store_id,category_id,title,description,price,status,city,district,
      neighborhood,lat,lng,images,attrs,phone_override,expires_at,approved_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,now()+interval '30 days',
       case when $9::text = 'ACTIVE' then now() end)`,
    [id,slug,userId,data.storeId || null,data.categoryId,data.title,data.description,data.price,status,data.city,data.district,
      data.neighborhood || null,coords?.lat ?? null,coords?.lng ?? null,JSON.stringify(data.images),JSON.stringify(data.attrs),phone],
  );
  await sql.query("insert into price_history (listing_id,price) values ($1,$2)", [id,data.price]);
  if (status === "ACTIVE") {
    void notifySearchHits({ id,slug,user_id:userId,title:data.title,description:data.description,category_id:data.categoryId,
      city:data.city,district:data.district,neighborhood:data.neighborhood || null,price:data.price,attrs:data.attrs }).catch(() => undefined);
  }
  return { id, slug, status };
}
