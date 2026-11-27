import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { foldTr } from "@/lib/search-params";
import { asIso, asJson, newId, num } from "@/lib/utils";
import { categoryPath, findCategory, getCategoryTree } from "./category-cache";
import { notify, rateLimit } from "./helpers";

type JsonLeaf = string | number | boolean | null;
export type SavedSearchFilters = Record<string, JsonLeaf | JsonLeaf[]>;

const jsonLeaf = z.union([z.string().max(120), z.number(), z.boolean(), z.null()]);
const filtersSchema = z
  .record(z.string().max(60), z.union([jsonLeaf, z.array(jsonLeaf).max(20)]))
  .refine((obj) => Object.keys(obj).length <= 30 && JSON.stringify(obj).length <= 4096, "Filtre verisi çok büyük.");

export type SavedSearch = {
  id: string;
  user_id: string;
  name: string;
  category_slug: string | null;
  city: string | null;
  district: string | null;
  q: string | null;
  min_price: number | null;
  max_price: number | null;
  filters: SavedSearchFilters;
  notify: boolean;
  last_notified_at: string | null;
  created_at: string;
};

type QuerySql = { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> };

const MAX_SAVED_SEARCHES_PER_USER = 20;

function mapSavedSearch(r: Record<string, unknown>): SavedSearch {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    name: String(r.name),
    category_slug: r.category_slug ? String(r.category_slug) : null,
    city: r.city ? String(r.city) : null,
    district: r.district ? String(r.district) : null,
    q: r.q ? String(r.q) : null,
    min_price: r.min_price == null ? null : num(r.min_price),
    max_price: r.max_price == null ? null : num(r.max_price),
    filters: asJson<SavedSearchFilters>(r.filters, {}),
    notify: Boolean(r.notify),
    last_notified_at: r.last_notified_at ? asIso(r.last_notified_at) : null,
    created_at: asIso(r.created_at),
  };
}

export const listSavedSearches = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select id, user_id, name, category_slug, city, district, q, min_price, max_price,
              filters, notify, last_notified_at, created_at
       from saved_searches
       where user_id = $1
       order by created_at desc
       limit $2`,
      [context.userId, MAX_SAVED_SEARCHES_PER_USER],
    );
    return rows.map(mapSavedSearch);
  });

export const createSavedSearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1, "Arama adı girin").max(80),
      category_slug: z.string().trim().max(120).optional().nullable(),
      city: z.string().trim().max(60).optional().nullable(),
      district: z.string().trim().max(60).optional().nullable(),
      q: z.string().trim().max(200).optional().nullable(),
      min_price: z.number().min(0).max(1_000_000_000).optional().nullable(),
      max_price: z.number().min(0).max(1_000_000_000).optional().nullable(),
      filters: filtersSchema.optional(),
      notify: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    rateLimit(`saved-search:${context.userId}`, 15, 60_000);
    const sql = await getSql();
    const row = await sql.transaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock(hashtext('saved-search:' || $1))", [context.userId]);
      const countRows = await tx.query<{ n: number }>(
        "select count(*)::int as n from saved_searches where user_id = $1",
        [context.userId],
      );
      if ((countRows[0]?.n ?? 0) >= MAX_SAVED_SEARCHES_PER_USER) {
        throw new Error(`En fazla ${MAX_SAVED_SEARCHES_PER_USER} kayıtlı arama oluşturabilirsiniz.`);
      }
      const id = newId("ss");
      const rows = await tx.query<Record<string, unknown>>(
        `insert into saved_searches (id, user_id, name, category_slug, city, district, q, min_price, max_price, filters, notify)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
         returning id, user_id, name, category_slug, city, district, q, min_price, max_price, filters, notify, last_notified_at, created_at`,
        [
          id,
          context.userId,
          data.name,
          data.category_slug || null,
          data.city || null,
          data.district || null,
          data.q || null,
          data.min_price ?? null,
          data.max_price ?? null,
          JSON.stringify(data.filters ?? {}),
          data.notify ?? true,
        ],
      );
      return rows[0];
    });
    return mapSavedSearch(row);
  });

export const deleteSavedSearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().max(100) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query("delete from saved_searches where id = $1 and user_id = $2", [data.id, context.userId]);
    return { ok: true };
  });

export const toggleSavedSearchNotify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().max(100), notify: z.boolean() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      "update saved_searches set notify = $3 where id = $1 and user_id = $2 returning id",
      [data.id, context.userId, data.notify],
    );
    if (!rows[0]) throw new Error("Kayıtlı arama bulunamadı.");
    return { ok: true, notify: data.notify };
  });

/** Notify up to 50 users whose saved search matches a newly published ACTIVE listing. */
export async function notifyMatchingSavedSearches(
  sql: QuerySql,
  listing: {
    id: string;
    title: string;
    slug: string;
    userId: string;
    categoryId?: string;
    categorySlug: string;
    city: string | null;
    district: string | null;
    neighborhood?: string | null;
    price: number;
    hasImages?: boolean;
    isStore?: boolean;
    attrs?: Record<string, unknown>;
  },
): Promise<number> {
  const tree = await getCategoryTree();
  const cat = findCategory(tree, listing.categorySlug);
  const categorySlugs = cat ? categoryPath(tree, cat.id).map((c) => c.slug) : [listing.categorySlug];

  const candidates = await sql.query<{
    id: string;
    user_id: string;
    name: string;
    q: string | null;
    filters: unknown;
  }>(
    `select ss.id, ss.user_id, ss.name, ss.q, ss.filters
     from saved_searches ss
     join profiles p on p.user_id = ss.user_id
     where ss.notify = true
       and ss.user_id <> $1
       and p.banned_at is null
       and p.deletion_requested_at is null
       and not exists (
         select 1 from user_blocks b
         where (b.blocker_id = ss.user_id and b.blocked_id = $1)
            or (b.blocker_id = $1 and b.blocked_id = ss.user_id)
       )
       and (ss.category_slug is null or ss.category_slug = any($2::text[]))
       and (ss.city is null or ss.city = $3)
       and (ss.district is null or ss.district = $4)
       and (ss.min_price is null or $5::numeric >= ss.min_price)
       and (ss.max_price is null or $5::numeric <= ss.max_price)
     order by ss.created_at desc
     limit 200`,
    [listing.userId, categorySlugs, listing.city, listing.district, listing.price],
  );

  if (!candidates.length) return 0;

  const foldedTitle = foldTr(listing.title);
  const attrs = listing.attrs ?? {};
  const attrNumber = (keys: string[]) => {
    for (const k of keys) {
      const v = attrs[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
    }
    return null;
  };
  const listingYear = attrNumber(["Yıl", "Model Yılı", "Bina Yaşı"]);
  const listingKm = attrNumber(["Kilometre", "KM"]);
  const listingM2 = attrNumber(["m² (Brüt)", "m² (Net)", "Metrekare", "m2"]);

  const matched = candidates
    .filter((row) => {
      if (row.q?.trim()) {
        const words = foldTr(row.q.trim()).split(/\s+/).filter(Boolean);
        if (!words.every((w) => foldedTitle.includes(w))) return false;
      }
      const f = asJson<SavedSearchFilters>(row.filters, {});
      if (typeof f.neighborhood === "string" && f.neighborhood.trim() && f.neighborhood !== listing.neighborhood) return false;
      if (f.withPhotos === true && listing.hasImages === false) return false;
      if (f.sellerType === "store" && listing.isStore === false) return false;
      if (f.sellerType === "individual" && listing.isStore === true) return false;
      if (typeof f.minYear === "number" && (listingYear == null || listingYear < f.minYear)) return false;
      if (typeof f.maxYear === "number" && (listingYear == null || listingYear > f.maxYear)) return false;
      if (typeof f.minKm === "number" && (listingKm == null || listingKm < f.minKm)) return false;
      if (typeof f.maxKm === "number" && (listingKm == null || listingKm > f.maxKm)) return false;
      if (typeof f.minM2 === "number" && (listingM2 == null || listingM2 < f.minM2)) return false;
      if (typeof f.maxM2 === "number" && (listingM2 == null || listingM2 > f.maxM2)) return false;
      for (const [k, want] of Object.entries(f)) {
        if (!k.startsWith("attr_")) continue;
        const attrKey = k.slice(5);
        const have = attrs[attrKey];
        if (Array.isArray(want)) {
          if (!want.length) continue;
          const haveStr = have == null ? "" : String(have);
          if (!want.some((w) => String(w) === haveStr || haveStr.split(/,\s*/).includes(String(w)))) return false;
        } else if (want != null && want !== "") {
          if (have == null || String(have) !== String(want)) return false;
        }
      }
      return true;
    })
    .slice(0, 50);

  if (!matched.length) return 0;

  await sql.query(
    "update saved_searches set last_notified_at = now() where id = any($1::text[])",
    [matched.map((m) => m.id)],
  );

  const seenUsers = new Set<string>();
  const uniqueUserMatches = matched.filter((m) => {
    if (seenUsers.has(m.user_id)) return false;
    seenUsers.add(m.user_id);
    return true;
  });

  await Promise.allSettled(
    uniqueUserMatches.map((m) =>
      notify(m.user_id, "listing", `Yeni ilan: ${m.name}`, listing.title, `/ilan/${listing.slug}`),
    ),
  );

  return matched.length;
}
