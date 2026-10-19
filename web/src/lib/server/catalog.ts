import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { listingNoFromSlug, num } from "@/lib/utils";
import type { PhoneVisibility } from "@/lib/notification-prefs";
import {
  inheritedAttributes,
  listingSelect,
  mapListing,
  subtreeIds,
  firstInWindow,
  viewerKey,
  type CategoryRow,
  type ListingCard,
} from "./helpers";
import { CITY_COORDS } from "@/lib/data/geo";
import { inferSearchCategoryId } from "@/lib/search-params";
import {
  categoryPath,
  getCategoryCounts,
  getCategoryTree,
  pickCounts,
  type CategoryNode,
} from "./category-cache";
import { getSessionUser } from "@/lib/auth/verify.server";
import { getRequest } from "@tanstack/react-start/server";

const Filters = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  neighborhood: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  sort: z.enum(["date_desc", "date_asc", "price_asc", "price_desc", "views_desc"]).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(48).optional(),
  attrs: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.number()])).optional(),
  minYear: z.number().optional(),
  maxYear: z.number().optional(),
  minKm: z.number().optional(),
  maxKm: z.number().optional(),
  minM2: z.number().optional(),
  maxM2: z.number().optional(),
  featured: z.boolean().optional(),
  urgent: z.boolean().optional(),
  userId: z.string().optional(),
  storeId: z.string().optional(),
});

/**
 * `status` is server-only: the public `searchCatalog` validator strips it, so
 * visitors only ever see ACTIVE listings.
 */
export type SearchFilters = z.infer<typeof Filters> & {
  status?: string;
  /** Skip the COUNT query when the caller ignores `total`/`pages`. */
  skipCount?: boolean;
};

export async function searchListings(f: SearchFilters): Promise<{
  listings: ListingCard[];
  total: number;
  page: number;
  pages: number;
}> {
  const sql = await getSql();
  const page = f.page ?? 1;
  const limit = f.limit ?? 20;
  const offset = (page - 1) * limit;
  const conds: string[] = [];
  const params: unknown[] = [];
  const add = (sqlFrag: string, value: unknown) => {
    params.push(value);
    conds.push(sqlFrag.replace("?", `$${params.length}`));
  };

  add("l.status = ?", f.status ?? "ACTIVE");
  if ((f.status ?? "ACTIVE") === "ACTIVE") {
    conds.push("(l.expires_at is null or l.expires_at > now())");
  }

  if (f.q?.trim()) {
    // Escape LIKE wildcards so user-typed % and _ are literal characters
    const term = f.q.trim();
    const escaped = term.replace(/%/g, "\\%").replace(/_/g, "\\_");
    params.push(`%${escaped}%`);
    const i = params.length;
    // Each branch can use its own index (title/description trigram, store_id),
    // so Postgres can combine them instead of scanning every listing.
    const ors = [
      `l.title ilike $${i}`,
      `l.description ilike $${i}`,
      `l.store_id = any(array(select st.id from stores st where st.name ilike $${i}))`,
    ];
    // "#1000005" or "1000005": the listing number.
    const listingNo = /^#?\d{1,15}$/.test(term) ? term.replace("#", "") : null;
    if (listingNo) {
      params.push(listingNo);
      ors.push(`l.listing_no = $${params.length}::bigint`);
    }
    conds.push(`(${ors.join(" or ")})`);
  }
  if (f.category) {
    const ids = await subtreeIds(f.category);
    if (ids.length) {
      // One array parameter instead of thousands of placeholders for big subtrees.
      params.push(ids);
      conds.push(`l.category_id = any($${params.length}::text[])`);
    }
  }
  if (f.city) add("l.city = ?", f.city);
  if (f.district) add("l.district = ?", f.district);
  if (f.neighborhood) add("l.neighborhood = ?", f.neighborhood);
  if (f.minPrice != null && f.minPrice >= 0) add("l.price >= ?", f.minPrice);
  if (f.maxPrice != null && f.maxPrice > 0) add("l.price <= ?", f.maxPrice);
  if (f.userId) add("l.user_id = ?", f.userId);
  if (f.storeId) add("l.store_id = ?", f.storeId);
  if (f.featured) conds.push("l.featured_until is not null and l.featured_until > now()");
  if (f.urgent) {
    conds.push(
      "exists (select 1 from boosts b where b.listing_id = l.id and b.kind = 'ACIL' and b.ends_at > now())",
    );
  }

  const jsonNum = (keys: string | string[], op: string, value: number) => {
    params.push(value);
    const n = params.length;
    const list = Array.isArray(keys) ? keys : [keys];
    const parts = list.map((key) => `(l.attrs->>'${key}' ~ '^[0-9.]+$' and (l.attrs->>'${key}')::numeric ${op} $${n})`);
    conds.push(`(${parts.join(" or ")})`);
  };
  if (f.minYear != null) jsonNum("Yıl", ">=", f.minYear);
  if (f.maxYear != null) jsonNum("Yıl", "<=", f.maxYear);
  if (f.minKm != null) jsonNum("KM", ">=", f.minKm);
  if (f.maxKm != null) jsonNum("KM", "<=", f.maxKm);
  if (f.minM2 != null) jsonNum(["m²", "m² (Net)"], ">=", f.minM2);
  if (f.maxM2 != null) jsonNum(["m²", "m² (Net)"], "<=", f.maxM2);

  if (f.attrs) {
    for (const [key, val] of Object.entries(f.attrs)) {
      if (val == null || val === "" || (Array.isArray(val) && val.length === 0)) continue;
      const values = Array.isArray(val) ? val.map(String) : [String(val)];
      params.push(key);
      const k = params.length;
      const ors = values.map((v) => {
        params.push(v);
        const p = `$${params.length}`;
        return `(l.attrs->>$${k} = ${p} or l.attrs->>$${k} like ${p} || ', %' or l.attrs->>$${k} like '%, ' || ${p} or l.attrs->>$${k} like '%, ' || ${p} || ', %')`;
      });
      conds.push(`(${ors.join(" or ")})`);
    }
  }

  const where = conds.length ? `where ${conds.join(" and ")}` : "";
  const sort = f.sort ?? "date_desc";
  const order =
    sort === "price_asc"
      ? "l.price asc, l.created_at desc"
      : sort === "price_desc"
        ? "l.price desc, l.created_at desc"
        : sort === "date_asc"
          ? "l.created_at asc"
          : sort === "views_desc"
            ? "l.view_count desc, l.created_at desc"
            : `(l.featured_until is not null and l.featured_until > now()) desc, l.created_at desc`;

  // Snapshot params before appending limit/offset so COUNT uses the right set
  const countParams = [...params];

  params.push(limit);
  const lim = params.length;
  params.push(offset);
  const off = params.length;

  // Run COUNT and data fetch in parallel — cuts latency roughly in half
  const [countRows, rows] = await Promise.all([
    f.skipCount
      ? Promise.resolve([] as { n: number }[])
      : sql.query<{ n: number }>(
          `select count(*)::int as n
           from listings l
           ${where}`,
          countParams,
        ),
    sql.query<Record<string, unknown>>(
      `select ${listingSelect("", true)},
         coalesce((
           select json_agg(b.kind) from boosts b
           where b.listing_id = l.id and b.ends_at > now()
         ), '[]'::json) as boosts
       from listings l
       join categories c on c.id = l.category_id
       left join profiles p on p.user_id = l.user_id
       left join stores s on s.id = l.store_id
       ${where}
       order by ${order}
       limit $${lim} offset $${off}`,
      params,
    ),
  ]);
  const total = countRows[0]?.n ?? 0;

  return {
    listings: rows.map(mapListing),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Root categories with their live-listing counts — what the home page and the
 * search sidebar show. The full tree has thousands of rows and stays on the server.
 */
export const listCategoryRoots = createServerFn({ method: "GET" }).handler(async () => {
  const [tree, counts] = await Promise.all([getCategoryTree(), getCategoryCounts()]);
  const roots = tree.children.get(null) ?? [];
  return { roots, counts: pickCounts(counts, roots) };
});

/**
 * One level of the category picker: the rows along `path` (root first) and the
 * children of its last entry (the roots for an empty path), with counts.
 */
export const browseCategories = createServerFn({ method: "GET" })
  .validator(z.object({ path: z.array(z.string().max(200)).max(20) }))
  .handler(async ({ data }) => {
    const [tree, counts] = await Promise.all([getCategoryTree(), getCategoryCounts()]);
    const pathRows = data.path.map((id) => tree.byId.get(id)).filter((c): c is CategoryNode => Boolean(c));
    const last = data.path.length ? pathRows[pathRows.length - 1]?.id : null;
    const children = last === undefined ? [] : (tree.children.get(last) ?? []);
    return { pathRows, children, counts: pickCounts(counts, children) };
  });

export const getCategory = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const tree = await getCategoryTree();
    const cat = tree.bySlug.get(data.slug.toLowerCase());
    if (!cat) return { category: null as CategoryRow | null, path: [] as CategoryRow[], children: [] as CategoryRow[], attributes: [] as Awaited<ReturnType<typeof inheritedAttributes>> };
    const attributes = await inheritedAttributes(cat.id);
    return {
      category: cat as CategoryRow,
      path: categoryPath(tree, cat.id) as CategoryRow[],
      children: (tree.children.get(cat.id) ?? []) as CategoryRow[],
      attributes,
    };
  });

export const searchCatalog = createServerFn({ method: "POST" })
  .validator(Filters)
  .handler(async ({ data }) => searchListings(data));

/**
 * Search results plus, for a text search without a category, the category the
 * results narrow down to (so the page can offer that category's filters).
 */
export const searchCatalogWithContext = createServerFn({ method: "POST" })
  .validator(Filters)
  .handler(async ({ data }) => {
    const result = await searchListings(data);
    let inferredCategorySlug: string | null = null;
    if (!data.category && data.q?.trim()) {
      const tree = await getCategoryTree();
      const id = inferSearchCategoryId(result.listings.map((l) => l.category_id), tree.rows);
      inferredCategorySlug = id ? (tree.byId.get(id)?.slug ?? null) : null;
    }
    return { result, inferredCategorySlug };
  });

/** Memoize a server-side read for `ttlMs` (per process); failures are not kept. */
function cached<T>(ttlMs: number, load: () => Promise<T>): () => Promise<T> {
  let entry: { expiresAt: number; promise: Promise<T> } | null = null;
  return () => {
    if (entry && Date.now() < entry.expiresAt) return entry.promise;
    const next = {
      expiresAt: Date.now() + ttlMs,
      promise: load().catch((err) => {
        if (entry === next) entry = null;
        throw err;
      }),
    };
    entry = next;
    return next.promise;
  };
}

// The home page is the busiest page and these change slowly; a few seconds of
// staleness saves several queries per visit.
const homeFeatured = cached(20_000, async () => {
  // date_desc already sorts featured_until items first, so one call is enough
  const result = await searchListings({ limit: 8, page: 1, sort: "date_desc", skipCount: true });
  return result.listings;
});

export const featuredListings = createServerFn({ method: "GET" }).handler(() => homeFeatured());

export const getListing = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().max(200) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    // New URLs end in the listing number, which alone identifies the listing (the
    // text before it may be stale after a title edit). Older links used the
    // pre-number slug or the raw id. The route redirects all of them to `slug`.
    const listingNo = listingNoFromSlug(data.slug);
    const where = listingNo
      ? "l.listing_no = $1::bigint"
      : "lower(l.slug) = lower($1) or lower(l.legacy_slug) = lower($1) or l.id = $1";
    const rows = await sql.query<Record<string, unknown>>(
      `select ${listingSelect()}, l.phone_override, p.phone as profile_phone, p.avatar_url as profile_avatar,
         coalesce(p.phone_visibility, 'members') as phone_visibility, coalesce(p.show_whatsapp, true) as show_whatsapp,
         (l.approved_at is not null) as approved,
         (select count(*)::int from favorites where listing_id = l.id) as fav_count,
         (select count(*)::int from phone_reveals where listing_id = l.id) as phone_reveal_count,
         coalesce((select json_agg(b.kind) from boosts b where b.listing_id = l.id and b.ends_at > now()), '[]'::json) as boosts
       from listings l
       join categories c on c.id = l.category_id
       left join profiles p on p.user_id = l.user_id
       left join stores s on s.id = l.store_id
       where ${where}
       limit 1`,
      [listingNo ? String(listingNo) : data.slug],
    );
    if (!rows[0]) return null;
    const listing = mapListing(rows[0]);

    // Yayında olmayan ilanlar sadece sahibine veya admin'e görünür
    const isPubliclyVisible = listing.status === "ACTIVE";
    if (!isPubliclyVisible) {
      const sessionUser = await getSessionUser();
      if (!sessionUser) return null;
      // Sahibi mi veya admin mi kontrol et
      const profile = await sql.query<{ role: string }>(
        "select role from profiles where user_id=$1",
        [sessionUser.id],
      );
      const isOwner = listing.user_id === sessionUser.id;
      const isAdmin = profile[0]?.role === "ADMIN";
      if (!isOwner && !isAdmin) return null;
    }
    if ((listing.lat == null || listing.lng == null) && listing.city && CITY_COORDS[listing.city]) {
      listing.lat = CITY_COORDS[listing.city].lat;
      listing.lng = CITY_COORDS[listing.city].lng;
    }
    // Everything below depends only on the listing row, so fetch it in parallel.
    const similarOf = (narrow: boolean) =>
      searchListings({
        category: listing.category_id,
        minPrice: narrow && listing.price > 0 ? listing.price * 0.7 : undefined,
        maxPrice: narrow && listing.price > 0 ? listing.price * 1.3 : undefined,
        limit: 6,
        page: 1,
        skipCount: true,
      }).then((r) => r.listings.filter((x) => x.id !== listing.id));
    const [tree, history, similarNarrow, seller] = await Promise.all([
      getCategoryTree(),
      sql.query<{ price: string | number; recorded_at: string }>(
        "select price, recorded_at from price_history where listing_id = $1 order by recorded_at asc",
        [listing.id],
      ),
      similarOf(true),
      sql.query<Record<string, unknown>>(
        `select p.user_id, p.display_name, p.city, p.created_at, p.avatar_url, p.bio,
                (select count(*)::int from listings where user_id = p.user_id and status = 'ACTIVE') as listing_count,
                (select coalesce(avg(rating),0) from reviews where seller_id = p.user_id) as rating_avg,
                (select count(*)::int from reviews where seller_id = p.user_id) as rating_count
         from profiles p where p.user_id = $1`,
        [listing.user_id],
      ),
    ]);
    const path = categoryPath(tree, listing.category_id) as CategoryRow[];
    const filteredSimilar = similarNarrow.length > 0 || listing.price <= 0 ? similarNarrow : await similarOf(false);
    const phoneVisibility = String(rows[0].phone_visibility) as PhoneVisibility;
    const hasPhone =
      phoneVisibility !== "hidden" &&
      Boolean(
        (typeof rows[0].phone_override === "string" && rows[0].phone_override.trim()) ||
        (typeof rows[0].profile_phone === "string" && rows[0].profile_phone.trim())
      );
    return {
      listing,
      path,
      history: history.map((h) => ({ price: num(h.price), at: String(h.recorded_at) })),
      similar: filteredSimilar.slice(0, 4),
      seller: seller[0]
        ? {
            id: String(seller[0].user_id),
            name: String(seller[0].display_name ?? "Satıcı"),
            city: seller[0].city ? String(seller[0].city) : null,
            since: String(seller[0].created_at),
            avatar: seller[0].avatar_url ? String(seller[0].avatar_url) : (rows[0].profile_avatar ? String(rows[0].profile_avatar) : null),
            bio: seller[0].bio ? String(seller[0].bio) : null,
            listing_count: num(seller[0].listing_count),
            rating_avg: num(seller[0].rating_avg),
            rating_count: num(seller[0].rating_count),
          }
        : null,
      store: rows[0].store_name
        ? {
            name: String(rows[0].store_name),
            slug: String(rows[0].store_slug ?? ""),
          }
        : null,
      has_phone: hasPhone,
      /** Signed-out visitors may reveal the phone only when this is "everyone". */
      phone_visibility: phoneVisibility,
      show_whatsapp: Boolean(rows[0].show_whatsapp),
      /** Owner may put it back live without moderation (it was approved before). */
      approved: Boolean(rows[0].approved),
      fav_count: num(rows[0].fav_count),
      phone_reveal_count: num(rows[0].phone_reveal_count),
    };
  });

export const incrementView = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    // One view per visitor and listing every 30 minutes, so reloads or a script
    // cannot inflate the "most viewed" ordering.
    const request = getRequest();
    const viewer = request ? viewerKey(request.headers) : "unknown";
    if (!firstInWindow(`view:${data.id}:${viewer}`, 30 * 60_000)) return { ok: true };
    const sql = await getSql();
    await sql.query("update listings set view_count = view_count + 1 where id = $1", [data.id]);
    return { ok: true };
  });

export const getLegal = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ slug: string; title: string; body: string }>(
      "select slug, title, body from legal_pages where slug = $1",
      [data.slug],
    );
    return rows[0] ?? null;
  });

const homeStats = cached(60_000, async () => {
  const sql = await getSql();
  const rows = await sql.query<{ listings: number; cities: number }>(
    `select count(*)::int as listings, count(distinct city)::int as cities
     from listings where status = 'ACTIVE' and (expires_at is null or expires_at > now())`,
  );
  return rows[0] ?? { listings: 0, cities: 0 };
});

export const statsHome = createServerFn({ method: "GET" }).handler(() => homeStats());

export type SiteSettings = {
  company_name: string;
  iban: string;
  bank_name: string;
  account_holder: string;
  support_email: string;
  support_phone: string;
};

const SETTING_DEFAULTS: SiteSettings = {
  company_name: "GeldeSat",
  iban: "",
  bank_name: "",
  account_holder: "",
  support_email: "destek@geldesat.com",
  support_phone: "",
};

// In-memory cache — site settings rarely change; refresh every 60 s
let _settingsCache: { data: SiteSettings; expiresAt: number } | null = null;
const SETTINGS_TTL_MS = 60_000;

/** Drop the cached settings so the next read sees an admin's change at once. */
export function clearSiteSettingsCache() {
  _settingsCache = null;
}

export async function loadSiteSettings(): Promise<SiteSettings> {
  if (_settingsCache && Date.now() < _settingsCache.expiresAt) {
    return _settingsCache.data;
  }
  const sql = await getSql();
  try {
    const rows = await sql.query<{ key: string; value: string }>("select key, value from site_settings");
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const settings: SiteSettings = {
      company_name: map.company_name || SETTING_DEFAULTS.company_name,
      iban: map.iban || "",
      bank_name: map.bank_name || "",
      account_holder: map.account_holder || "",
      support_email: map.support_email || SETTING_DEFAULTS.support_email,
      support_phone: map.support_phone || "",
    };
    _settingsCache = { data: settings, expiresAt: Date.now() + SETTINGS_TTL_MS };
    return settings;
  } catch {
    return SETTING_DEFAULTS;
  }
}

export const getSiteSettings = createServerFn({ method: "GET" }).handler(() => loadSiteSettings());
