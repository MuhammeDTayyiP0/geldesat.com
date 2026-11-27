import { redirect } from "@tanstack/react-router";
import { liveSql } from "@/lib/listing-status";
import { foldTr, inferSearchCategoryId } from "@/lib/search-params";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { asIso, listingNoFromSlug, num } from "@/lib/utils";
import type { PhoneVisibility } from "@/lib/notification-prefs";
import {
  inheritedAttributes,
  listingSelect,
  mapListing,
  rateLimit,
  subtreeIds,
  firstInWindow,
  viewerKey,
  type CategoryRow,
  type ListingCard,
} from "./helpers";
import { CITY_COORDS } from "@/lib/data/geo";
import { TURKEY_CITIES } from "@/lib/data/locations";
import {
  categoryPath,
  getCategoryCounts,
  getCategoryTree,
  subtreeOf,
  pickCounts,
  type CategoryNode,
} from "./category-cache";
import { getSessionUser } from "@/lib/auth/verify.server";
import { getRequest } from "@tanstack/react-start/server";
import { getSellerResponseStats } from "./chat";
import { recordListingView } from "./recently-viewed";

const Filters = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  neighborhood: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  // "newest" ignores vitrin promotion, for the home feed under the vitrin rail.
  sort: z.enum(["date_desc", "date_asc", "price_asc", "price_desc", "views_desc", "newest", "distance"]).optional(),
  nearLat: z.number().min(-90).max(90).optional(),
  nearLng: z.number().min(-180).max(180).optional(),
  maxDistanceKm: z.number().min(1).max(500).optional(),
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
  postedWithin: z.union([z.enum(["1", "3", "7", "30"]), z.number().int().min(1).max(30)]).optional(),
  withPhotos: z.boolean().optional(),
  sellerType: z.enum(["owner", "store"]).optional(),
  priceDropped: z.boolean().optional(),
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

const escapeLike = (text: string) => text.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

export async function searchListings(f: SearchFilters): Promise<{
  listings: ListingCard[];
  total: number;
  page: number;
  pages: number;
}> {
  const sql = await getSql();
  const page = Math.min(Math.max(1, f.page ?? 1), 500);
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

  const qTrimmed = f.q?.trim().slice(0, 200);
  if (qTrimmed) {
    // Every word must appear somewhere: in the text, or as the listing's category.
    const term = qTrimmed;
    const words = foldTr(term).split(/\s+/).filter(Boolean).slice(0, 8);
    const tree = await getCategoryTree();
    const ands: string[] = [];
    for (const word of words) {
      params.push(`%${escapeLike(word)}%`);
      const textCond = `l.search_text like $${params.length}`;
      const named = tree.rows.filter((c) => foldTr(c.name).includes(word)).slice(0, 40);
      const ids = [...new Set(named.flatMap((c) => subtreeOf(tree, c.id)))];
      if (ids.length) {
        params.push(ids);
        ands.push(`(${textCond} or l.category_id = any($${params.length}::text[]))`);
      } else ands.push(textCond);
    }
    params.push(`%${escapeLike(foldTr(term))}%`);
    const ors = [`(${ands.join(" and ")})`, `l.store_id = any(array(select st.id from stores st where tr_fold(st.name) like $${params.length}))`];
    const listingNo = /^#?\d{1,15}$/.test(term) ? term.replace("#", "") : null;
    if (listingNo) {
      params.push(listingNo);
      ors.push(`l.listing_no = $${params.length}::bigint`);
    }
    conds.push(`(${ors.join(" or ")})`);
  }
  if (f.category) {
    const ids = await subtreeIds(f.category);
    // An unknown category has no listings; ignoring it would show everything.
    if (!ids.length) conds.push("false");
    else {
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
  if (f.postedWithin) {
    const days = Number(f.postedWithin);
    if (days > 0) {
      params.push(days);
      conds.push(`l.created_at >= now() - make_interval(days => $${params.length})`);
    }
  }
  if (f.withPhotos) conds.push("jsonb_array_length(l.images) > 0");
  if (f.sellerType === "store") conds.push("l.store_id is not null");
  else if (f.sellerType === "owner") conds.push("l.store_id is null");
  if (f.priceDropped) {
    conds.push("exists (select 1 from price_history ph where ph.listing_id = l.id and ph.price > l.price)");
  }

  const jsonNum = (keys: string | string[], op: string, value: number) => {
    params.push(value);
    const n = params.length;
    const list = Array.isArray(keys) ? keys : [keys];
    // CASE guarantees the regex runs first; a value like "1.2.3" must not fail the whole search.
    const parts = list.map((key) => `(case when l.attrs->>'${key}' ~ '^[0-9]+(\\.[0-9]+)?$' then (l.attrs->>'${key}')::numeric end ${op} $${n})`);
    conds.push(`(${parts.join(" or ")})`);
  };
  if (f.minYear != null) jsonNum("Yıl", ">=", f.minYear);
  if (f.maxYear != null) jsonNum("Yıl", "<=", f.maxYear);
  if (f.minKm != null) jsonNum("KM", ">=", f.minKm);
  if (f.maxKm != null) jsonNum("KM", "<=", f.maxKm);
  if (f.minM2 != null) jsonNum(["m²", "m² (Net)"], ">=", f.minM2);
  if (f.maxM2 != null) jsonNum(["m²", "m² (Net)"], "<=", f.maxM2);

  if (f.attrs) {
    for (const [key, val] of Object.entries(f.attrs).slice(0, 20)) {
      if (val == null || val === "" || (Array.isArray(val) && val.length === 0)) continue;
      const values = (Array.isArray(val) ? val.map(String) : [String(val)]).slice(0, 20);
      params.push(key);
      const k = params.length;
      const ors = values.map((v) => {
        params.push(v);
        const exact = `$${params.length}`;
        params.push(escapeLike(v));
        const esc = `$${params.length}`;
        return `(l.attrs->>$${k} = ${exact} or l.attrs->>$${k} like ${esc} || ', %' or l.attrs->>$${k} like '%, ' || ${esc} or l.attrs->>$${k} like '%, ' || ${esc} || ', %')`;
      });
      conds.push(`(${ors.join(" or ")})`);
    }
  }

  const where = conds.length ? `where ${conds.join(" and ")}` : "";
  const hasGeo =
    typeof f.nearLat === "number" &&
    Number.isFinite(f.nearLat) &&
    typeof f.nearLng === "number" &&
    Number.isFinite(f.nearLng);
  let distanceSelect = "";
  let distanceOrderExpr = "";
  if (hasGeo) {
    params.push(f.nearLat);
    const latP = `$${params.length}`;
    params.push(f.nearLng);
    const lngP = `$${params.length}`;
    const haversine = `(case when l.lat is not null and l.lng is not null then 6371.0 * acos(least(1.0, greatest(-1.0, cos(radians(${latP})) * cos(radians(l.lat)) * cos(radians(l.lng) - radians(${lngP})) + sin(radians(${latP})) * sin(radians(l.lat))))) else null end)`;
    distanceSelect = `, ${haversine} as distance_km`;
    distanceOrderExpr = haversine;
    if (typeof f.maxDistanceKm === "number" && Number.isFinite(f.maxDistanceKm) && f.maxDistanceKm > 0) {
      params.push(Math.min(500, f.maxDistanceKm));
      const kmP = `$${params.length}`;
      conds.push(`l.lat is not null and l.lng is not null and ${haversine} <= ${kmP}`);
    }
  }
  const finalWhere = conds.length ? `where ${conds.join(" and ")}` : "";
  const sort = f.sort ?? "date_desc";
  const order =
    sort === "distance" && distanceOrderExpr
      ? `${distanceOrderExpr} asc nulls last, l.created_at desc`
      : sort === "price_asc"
        ? "l.price asc, l.created_at desc"
        : sort === "price_desc"
          ? "l.price desc, l.created_at desc"
          : sort === "date_asc"
            ? "l.created_at asc"
            : sort === "views_desc"
              ? "l.view_count desc, l.created_at desc"
              : sort === "newest"
                ? "l.created_at desc"
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
           ${finalWhere}`,
          countParams,
        ),
    sql.query<Record<string, unknown>>(
      `select ${listingSelect(distanceSelect, true)},
         coalesce((
           select json_agg(b.kind) from boosts b
           where b.listing_id = l.id and b.ends_at > now()
         ), '[]'::json) as boosts
       from listings l
       join categories c on c.id = l.category_id
       left join profiles p on p.user_id = l.user_id
       left join stores s on s.id = l.store_id
       ${finalWhere}
       order by ${order}, l.id
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

/**
 * Global category path search across the full category tree for the post-listing flow.
 * Matches multi-word queries across the category name and its ancestor names.
 */
export const searchCategoryPaths = createServerFn({ method: "POST" })
  .validator(z.object({ q: z.string().trim().min(2).max(80) }))
  .handler(async ({ data }) => {
    const words = foldTr(data.q).split(/\s+/).filter(Boolean).slice(0, 5);
    if (!words.length) return [] as Array<{ path: CategoryRow[]; leaf: CategoryRow }>;
    const tree = await getCategoryTree();
    const firstWord = words[0];
    const scored: Array<{ score: number; path: CategoryRow[]; leaf: CategoryRow }> = [];

    for (const cat of tree.rows) {
      const path = categoryPath(tree, cat.id);
      const foldedName = foldTr(cat.name);
      const foldedFull = path.map((p) => foldTr(p.name)).join(" ");
      if (!words.every((w) => foldedFull.includes(w))) continue;
      let score = 0;
      if (!cat.has_children) score += 100;
      if (foldedName.startsWith(firstWord)) score += 30;
      else if (foldedName.includes(firstWord)) score += 15;
      score -= path.length;
      scored.push({ score, path: path as CategoryRow[], leaf: cat as CategoryRow });
    }

    scored.sort((a, b) => b.score - a.score || a.leaf.name.localeCompare(b.leaf.name, "tr"));
    return scored.slice(0, 12).map(({ path, leaf }) => ({ path, leaf }));
  });

export const getCategory = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const tree = await getCategoryTree();
    const cat = tree.bySlug.get(data.slug.toLowerCase());
    if (!cat) {
      const sql = await getSql();
      const moved = (await sql.query<{ slug: string }>("select c.slug from category_old_slugs o join categories c on c.id = o.category_id where o.slug = $1", [data.slug.toLowerCase()]))[0];
      if (moved) throw redirect({ to: "/category/$slug", params: { slug: moved.slug }, statusCode: 301 });
    }
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
/** Home page rails, the same ones the app shows: urgent, showcase and the newest listings. */
const homeRails = cached(20_000, async () => {
  const sql = await getSql();
  const [urgent, featured, latest, priceDroppedRows] = await Promise.all([
    searchListings({ limit: 12, page: 1, sort: "date_desc", urgent: true, skipCount: true }),
    searchListings({ limit: 12, page: 1, sort: "date_desc", featured: true, skipCount: true }),
    searchListings({ limit: 24, page: 1, sort: "newest" }),
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
       where ${liveSql()}
         and exists (select 1 from price_history ph where ph.listing_id = l.id and ph.price > l.price)
       order by coalesce(
         (select max(ph.recorded_at) from price_history ph where ph.listing_id = l.id),
         l.created_at
       ) desc, l.created_at desc
       limit 8`,
    ),
  ]);
  return {
    urgent: urgent.listings,
    featured: featured.listings,
    latest: latest.listings,
    latestPages: latest.pages,
    priceDropped: priceDroppedRows.map(mapListing),
  };
});

export const homeListings = createServerFn({ method: "GET" }).handler(() => homeRails());

/** Lightweight search suggestions: matching categories, cities and exact listing number lookup. */
export const autocompleteSuggestions = createServerFn({ method: "POST" })
  .validator(z.object({ q: z.string().trim().max(80) }))
  .handler(async ({ data }) => {
    const term = data.q;
    if (!term) return { categories: [], cities: [], listing: null };
    const folded = foldTr(term);
    const tree = await getCategoryTree();

    const categories = tree.rows
      .filter((c) => foldTr(c.name).includes(folded))
      .sort((a, b) => {
        const aStarts = foldTr(a.name).startsWith(folded) ? 0 : 1;
        const bStarts = foldTr(b.name).startsWith(folded) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name, "tr");
      })
      .slice(0, 6)
      .map((c) => ({ name: c.name, slug: c.slug }));

    const cities = TURKEY_CITIES
      .filter((c) => foldTr(c.name).includes(folded))
      .sort((a, b) => {
        const aStarts = foldTr(a.name).startsWith(folded) ? 0 : 1;
        const bStarts = foldTr(b.name).startsWith(folded) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name, "tr");
      })
      .slice(0, 5)
      .map((c) => c.name);

    let listing: { listing_no: number; title: string; slug: string } | null = null;
    const listingNo = /^#?\d{1,15}$/.test(term) ? term.replace("#", "") : null;
    if (listingNo) {
      const sql = await getSql();
      const rows = await sql.query<{ listing_no: number; title: string; slug: string }>(
        `select listing_no, title, slug from listings l
         where l.listing_no = $1::bigint and ${liveSql()}
         limit 1`,
        [listingNo],
      );
      if (rows[0]) {
        listing = {
          listing_no: num(rows[0].listing_no),
          title: String(rows[0].title),
          slug: String(rows[0].slug),
        };
      }
    }

    return { categories, cities, listing };
  });

/** Live listings per city, for the map and the city list. */
export const mapCityCounts = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql.query<{ city: string; n: number }>(
    `select l.city, count(*)::int as n from listings l
     where ${liveSql()} and l.city is not null and l.city <> ''
     group by l.city order by n desc`,
  );
  return rows.map((r) => ({ city: r.city, n: num(r.n) }));
});

const BoundsInput = z.object({
  north: z.number().min(-90).max(90),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  west: z.number().min(-180).max(180),
  category: z.string().max(120).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  q: z.string().max(200).optional(),
});

export type MapBoundsFilter = z.infer<typeof BoundsInput>;

/** Fetch up to 4 live listings by id (preserving input order) for side-by-side comparison. */
export async function fetchListingsByIds(sql: Pick<Sql, "query">, ids: string[]): Promise<ListingCard[]> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 4);
  if (!uniqueIds.length) return [];
  const rows = await sql.query<Record<string, unknown>>(
    `select ${listingSelect("", false)},
            coalesce((select json_agg(b.kind) from boosts b where b.listing_id = l.id and b.ends_at > now()), '[]'::json) as boosts
     from listings l
     join categories c on c.id = l.category_id
     left join profiles p on p.user_id = l.user_id
     left join stores s on s.id = l.store_id
     where l.id = any($1::text[]) and ${liveSql()}`,
    [uniqueIds],
  );
  const byId = new Map(rows.map((r) => [String(r.id), mapListing(r)]));
  return uniqueIds.map((id) => byId.get(id)).filter((item): item is ListingCard => Boolean(item));
}

export const getListingsByIds = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string().min(1).max(120)).max(4) }))
  .handler(async ({ data }) => fetchListingsByIds(await getSql(), data.ids));

/** Fetch up to 200 live listings whose coordinates (or CITY_COORDS fallback) fall inside viewport bounds. */
export async function fetchMapListingsInBounds(
  sql: Pick<Sql, "query">,
  f: MapBoundsFilter,
): Promise<ListingCard[]> {
  if (f.south > f.north || f.west > f.east) return [];
  const conds: string[] = [liveSql()];
  const params: unknown[] = [];

  const citiesInBounds = Object.entries(CITY_COORDS)
    .filter(([, c]) => c.lat >= f.south && c.lat <= f.north && c.lng >= f.west && c.lng <= f.east)
    .map(([city]) => city);

  params.push(f.south, f.north, f.west, f.east);
  const sIdx = 1;
  const nIdx = 2;
  const wIdx = 3;
  const eIdx = 4;

  const coordCond = `(l.lat is not null and l.lng is not null and l.lat between $${sIdx} and $${nIdx} and l.lng between $${wIdx} and $${eIdx})`;
  if (citiesInBounds.length) {
    params.push(citiesInBounds);
    conds.push(`(${coordCond} or ((l.lat is null or l.lng is null) and l.city = any($${params.length}::text[])))`);
  } else {
    conds.push(coordCond);
  }

  if (f.category) {
    const ids = await subtreeIds(f.category);
    if (!ids.length) return [];
    params.push(ids);
    conds.push(`l.category_id = any($${params.length}::text[])`);
  }
  if (f.minPrice != null && f.minPrice >= 0) {
    params.push(f.minPrice);
    conds.push(`l.price >= $${params.length}`);
  }
  if (f.maxPrice != null && f.maxPrice > 0) {
    params.push(f.maxPrice);
    conds.push(`l.price <= $${params.length}`);
  }
  const qTrimmed = f.q?.trim().slice(0, 200);
  if (qTrimmed) {
    const words = foldTr(qTrimmed).split(/\s+/).filter(Boolean).slice(0, 8);
    for (const word of words) {
      params.push(`%${escapeLike(word)}%`);
      conds.push(`l.search_text like $${params.length}`);
    }
  }

  const rows = await sql.query<Record<string, unknown>>(
    `select ${listingSelect("", true)},
            coalesce((select json_agg(b.kind) from boosts b where b.listing_id = l.id and b.ends_at > now()), '[]'::json) as boosts
     from listings l
     join categories c on c.id = l.category_id
     left join profiles p on p.user_id = l.user_id
     left join stores s on s.id = l.store_id
     where ${conds.join(" and ")}
     order by (l.featured_until is not null and l.featured_until > now()) desc, l.created_at desc
     limit 200`,
    params,
  );
  return rows.map((row) => {
    const listing = mapListing(row);
    if ((listing.lat == null || listing.lng == null) && listing.city && CITY_COORDS[listing.city]) {
      listing.lat = CITY_COORDS[listing.city].lat;
      listing.lng = CITY_COORDS[listing.city].lng;
    }
    return listing;
  });
}

export const mapListingsInBounds = createServerFn({ method: "POST" })
  .validator(BoundsInput)
  .handler(async ({ data }) => fetchMapListingsInBounds(await getSql(), data));

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
      `select ${listingSelect()}, l.rejection_reason, l.phone_override, p.phone as profile_phone, p.avatar_url as profile_avatar,
         coalesce(p.phone_visibility, 'members') as phone_visibility, coalesce(p.show_whatsapp, true) as show_whatsapp,
         (l.approved_at is not null) as approved,
         (select count(*)::int from favorites where listing_id = l.id) as fav_count,
         (select count(distinct viewer_id)::int from phone_reveals where listing_id = l.id) as phone_reveal_count,
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

    // Sold and expired listings stay readable (not indexed); the rest only for the owner or an admin.
    const isPubliclyVisible = listing.status === "ACTIVE" || listing.status === "SOLD";
    if (!isPubliclyVisible) {
      const sessionUser = await getSessionUser();
      if (!sessionUser) return null;
      // Sahibi mi veya admin mi kontrol et
      const profile = await sql.query<{ role: string; banned_at: unknown; deletion_requested_at: unknown }>(
        "select role, banned_at, deletion_requested_at from profiles where user_id=$1",
        [sessionUser.id],
      );
      const isOwner = listing.user_id === sessionUser.id;
      const isAdmin = Boolean(profile[0] && profile[0].role === "ADMIN" && profile[0].banned_at == null && profile[0].deletion_requested_at == null);
      if (!isOwner && !isAdmin) return null;
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
    const [tree, history, similarNarrow, seller, responseStats, reviewRows, attrDefs] = await Promise.all([
      getCategoryTree(),
      sql.query<{ price: string | number; recorded_at: string }>(
        "select price, recorded_at from price_history where listing_id = $1 order by recorded_at asc",
        [listing.id],
      ),
      similarOf(true),
      sql.query<Record<string, unknown>>(
        `select p.user_id, p.display_name, p.city, p.created_at, p.avatar_url, p.bio, p.banned_at, p.deletion_requested_at,
                (select count(*)::int from listings where user_id = p.user_id and status = 'ACTIVE' and (expires_at is null or expires_at > now())) as listing_count,
                (select coalesce(avg(rating),0) from reviews where seller_id = p.user_id) as rating_avg,
                (select count(*)::int from reviews where seller_id = p.user_id) as rating_count
         from profiles p where p.user_id = $1`,
        [listing.user_id],
      ),
      getSellerResponseStats(sql, listing.user_id),
      sql.query<Record<string, unknown>>(
        `select r.id, r.rating, r.comment, r.created_at, p.display_name as reviewer
         from reviews r left join profiles p on p.user_id = r.reviewer_id
         where r.seller_id = $1 order by r.created_at desc limit 3`,
        [listing.user_id],
      ),
      inheritedAttributes(listing.category_id),
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
    const sellerHidden = Boolean(seller[0]?.banned_at || seller[0]?.deletion_requested_at);
    return {
      listing: {
        ...listing,
        // Units live on the category's attributes, not on the saved values.
        attr_units: Object.fromEntries(
          attrDefs.flatMap((a) => (a.unit ? [[a.name, a.unit] as const] : [])),
        ) as Record<string, string>,
      },
      path,
      history: history.map((h) => ({ price: num(h.price), at: asIso(h.recorded_at) })),
      similar: filteredSimilar.slice(0, 4),
      seller: seller[0] && !sellerHidden
        ? {
            id: String(seller[0].user_id),
            name: String(seller[0].display_name ?? "Satıcı"),
            city: seller[0].city ? String(seller[0].city) : null,
            since: asIso(seller[0].created_at),
            avatar: seller[0].avatar_url ? String(seller[0].avatar_url) : (rows[0].profile_avatar ? String(rows[0].profile_avatar) : null),
            bio: seller[0].bio ? String(seller[0].bio) : null,
            listing_count: num(seller[0].listing_count),
            rating_avg: num(seller[0].rating_avg),
            rating_count: num(seller[0].rating_count),
            responseStats,
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
      reviews: reviewRows.map((r) => ({
        id: String(r.id),
        rating: Number(r.rating),
        comment: String(r.comment ?? ""),
        reviewer: String(r.reviewer ?? "Üye"),
        at: asIso(r.created_at),
      })),
    };
  });

export const incrementView = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    // One view per visitor and listing every 30 minutes, so reloads or a script
    // cannot inflate the "most viewed" ordering.
    const request = getRequest();
    const user = await getSessionUser().catch(() => null);
    const viewer = request ? viewerKey(request.headers, user?.id) : user ? `u:${user.id}` : "unknown";
    rateLimit(`view-req:${viewer}`, 120, 60_000);
    // Signed-in visitors get the listing on their "Son baktıklarım" list every time.
    if (user) await recordListingView(user.id, data.id);
    if (!firstInWindow(`view:${data.id}:${viewer}`, 30 * 60_000)) return { ok: true };
    const sql = await getSql();
    await sql.query("update listings set view_count = view_count + 1 where id = $1 and status in ('ACTIVE', 'SOLD')", [data.id]);
    return { ok: true };
  });

export const getLegal = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ slug: string; title: string; body: string; updated_at: unknown }>(
      "select slug, title, body, updated_at from legal_pages where slug = $1",
      [data.slug],
    );
    return rows[0] ? { ...rows[0], updated_at: asIso(rows[0].updated_at) } : null;
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

/** Public contact details only; bank details are not for every visitor. */
export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { company_name, support_email, support_phone } = await loadSiteSettings();
  return { company_name, support_email, support_phone };
});

/** Median & quartile price range for similar active listings in a category (city-scoped when >=3 results exist). */
export const getCategoryPriceStats = createServerFn({ method: "POST" })
  .validator(
    z.object({
      categoryId: z.string().min(1),
      city: z.string().optional(),
      currency: z.enum(["TRY", "USD", "EUR"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const ids = await subtreeIds(data.categoryId);
    if (!ids.length) return null;
    const currency = data.currency ?? "TRY";
    const queryStats = async (cityFilter?: string) => {
      const params: unknown[] = [ids, currency];
      let cityCond = "";
      if (cityFilter) {
        params.push(cityFilter);
        cityCond = `and l.city = $${params.length}`;
      }
      const rows = await sql.query<{ count: number; p25: number | null; median: number | null; p75: number | null }>(
        `select count(*)::int as count,
                percentile_cont(0.25) within group (order by l.price)::float8 as p25,
                percentile_cont(0.5) within group (order by l.price)::float8 as median,
                percentile_cont(0.75) within group (order by l.price)::float8 as p75
         from listings l
         where l.status = 'ACTIVE'
           and (l.expires_at is null or l.expires_at > now())
           and l.category_id = any($1::text[])
           and l.currency = $2
           and l.price > 0
           ${cityCond}`,
        params,
      );
      return rows[0];
    };
    const cityTrim = data.city?.trim() || "";
    if (cityTrim) {
      const cityStats = await queryStats(cityTrim);
      if (cityStats && cityStats.count >= 3 && cityStats.p25 != null && cityStats.median != null && cityStats.p75 != null) {
        return {
          count: cityStats.count,
          p25: Math.round(cityStats.p25),
          median: Math.round(cityStats.median),
          p75: Math.round(cityStats.p75),
          currency,
          cityScoped: true,
        };
      }
    }
    const national = await queryStats();
    if (!national || national.count < 3 || national.p25 == null || national.median == null || national.p75 == null) {
      return null;
    }
    return {
      count: national.count,
      p25: Math.round(national.p25),
      median: Math.round(national.median),
      p75: Math.round(national.p75),
      currency,
      cityScoped: false,
    };
  });
