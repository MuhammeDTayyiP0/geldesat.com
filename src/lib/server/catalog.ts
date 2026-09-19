import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { num } from "@/lib/utils";
import {
  inheritedAttributes,
  listingSelect,
  mapListing,
  subtreeIds,
  type CategoryRow,
  type ListingCard,
} from "./helpers";

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
  userId: z.string().optional(),
  storeId: z.string().optional(),
  status: z.string().optional(),
});

export type SearchFilters = z.infer<typeof Filters>;

async function searchListings(f: SearchFilters): Promise<{
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
    const q = `%${f.q.trim()}%`;
    params.push(q);
    const i = params.length;
    params.push(q);
    const j = params.length;
    // ilan no (id/slug) + title/desc
    conds.push(`(l.title ilike $${i} or l.description ilike $${i} or l.id ilike $${j} or l.slug ilike $${j} or coalesce(s.name,'') ilike $${i})`);
  }
  if (f.category) {
    const ids = await subtreeIds(f.category);
    if (ids.length) {
      const placeholders = ids.map((id) => {
        params.push(id);
        return `$${params.length}`;
      });
      conds.push(`l.category_id in (${placeholders.join(",")})`);
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

  const countRows = await sql.query<{ n: number }>(
    `select count(*)::int as n
     from listings l
     left join stores s on s.id = l.store_id
     ${where}`,
    params,
  );
  const total = countRows[0]?.n ?? 0;

  params.push(limit);
  const lim = params.length;
  params.push(offset);
  const off = params.length;

  const rows = await sql.query<Record<string, unknown>>(
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
  );

  return {
    listings: rows.map(mapListing),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql.query<CategoryRow>(
    "select id, name, slug, parent_id, icon, sort_order from categories order by sort_order, name",
  );
  const counts = await sql.query<{ category_id: string; n: number }>(
    `select category_id, count(*)::int as n from listings
     where status = 'ACTIVE' and (expires_at is null or expires_at > now())
     group by category_id`,
  );
  const countMap = new Map(counts.map((c) => [c.category_id, c.n]));
  const byParent = new Map<string | null, CategoryRow[]>();
  const parentIds = new Set<string>();
  for (const r of rows) {
    const k = r.parent_id;
    const arr = byParent.get(k) ?? [];
    arr.push(r);
    byParent.set(k, arr);
    if (r.parent_id) parentIds.add(r.parent_id);
  }
  function withCount(id: string): number {
    let n = countMap.get(id) ?? 0;
    for (const child of byParent.get(id) ?? []) n += withCount(child.id);
    return n;
  }
  return {
    categories: rows.map((r) => ({ ...r, has_children: parentIds.has(r.id) })),
    counts: Object.fromEntries(rows.map((r) => [r.id, withCount(r.id)])),
    roots: rows.filter((r) => !r.parent_id).map((r) => ({ ...r, has_children: parentIds.has(r.id) })),
  };
});

export const getCategory = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<CategoryRow>(
      "select id, name, slug, parent_id, icon, sort_order from categories where slug = $1",
      [data.slug],
    );
    const cat = rows[0];
    if (!cat) return { category: null as CategoryRow | null, path: [] as CategoryRow[], children: [] as CategoryRow[], attributes: [] as Awaited<ReturnType<typeof inheritedAttributes>> };
    const all = await sql.query<CategoryRow>(
      "select id, name, slug, parent_id, icon, sort_order from categories",
    );
    const byId = new Map(all.map((c) => [c.id, c]));
    const path: CategoryRow[] = [];
    let cur: CategoryRow | undefined = cat;
    while (cur) {
      path.unshift(cur);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    const parentIds = new Set(all.map((c) => c.parent_id).filter((id): id is string => Boolean(id)));
    const children = all
      .filter((c) => c.parent_id === cat.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "tr"))
      .map((c) => ({ ...c, has_children: parentIds.has(c.id) }));
    const attributes = await inheritedAttributes(cat.id);
    return { category: cat, path, children, attributes };
  });

export const searchCatalog = createServerFn({ method: "POST" })
  .validator(Filters)
  .handler(async ({ data }) => searchListings(data));

export const featuredListings = createServerFn({ method: "GET" }).handler(async () => {
  const featured = await searchListings({ featured: true, limit: 8, page: 1, sort: "date_desc" });
  if (featured.listings.length >= 4) return featured.listings;
  const latest = await searchListings({ limit: 8, page: 1, sort: "date_desc" });
  const seen = new Set(featured.listings.map((l) => l.id));
  const merged = [...featured.listings];
  for (const l of latest.listings) {
    if (!seen.has(l.id)) merged.push(l);
    if (merged.length >= 8) break;
  }
  return merged;
});

export const getListing = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${listingSelect()}, l.phone_override,
         coalesce((select json_agg(b.kind) from boosts b where b.listing_id = l.id and b.ends_at > now()), '[]'::json) as boosts
       from listings l
       join categories c on c.id = l.category_id
       left join profiles p on p.user_id = l.user_id
       left join stores s on s.id = l.store_id
       where l.slug = $1 or l.id = $1`,
      [data.slug],
    );
    if (!rows[0]) return null;
    const listing = mapListing(rows[0]);
    const pathRows = await sql.query<CategoryRow>(
      `with recursive chain as (
         select id, name, slug, parent_id, icon, sort_order from categories where id = $1
         union all
         select c.id, c.name, c.slug, c.parent_id, c.icon, c.sort_order
         from categories c join chain ch on ch.parent_id = c.id
       )
       select * from chain`,
      [listing.category_id],
    );
    const path = [...pathRows].reverse();
    const history = await sql.query<{ price: string | number; recorded_at: string }>(
      "select price, recorded_at from price_history where listing_id = $1 order by recorded_at asc",
      [listing.id],
    );
    const similar = await searchListings({
      category: listing.category_id,
      minPrice: listing.price * 0.7,
      maxPrice: listing.price * 1.3,
      limit: 6,
      page: 1,
    });
    const seller = await sql.query<Record<string, unknown>>(
      `select p.user_id, p.display_name, p.city, p.created_at, p.avatar_url, p.bio,
              (select count(*)::int from listings where user_id = p.user_id and status = 'ACTIVE') as listing_count,
              (select coalesce(avg(rating),0) from reviews where seller_id = p.user_id) as rating_avg,
              (select count(*)::int from reviews where seller_id = p.user_id) as rating_count
       from profiles p where p.user_id = $1`,
      [listing.user_id],
    );
    return {
      listing,
      path,
      history: history.map((h) => ({ price: num(h.price), at: String(h.recorded_at) })),
      similar: similar.listings.filter((x) => x.id !== listing.id).slice(0, 4),
      seller: seller[0]
        ? {
            id: String(seller[0].user_id),
            name: String(seller[0].display_name ?? "Satıcı"),
            city: seller[0].city ? String(seller[0].city) : null,
            since: String(seller[0].created_at),
            avatar: seller[0].avatar_url ? String(seller[0].avatar_url) : null,
            bio: seller[0].bio ? String(seller[0].bio) : null,
            listing_count: num(seller[0].listing_count),
            rating_avg: num(seller[0].rating_avg),
            rating_count: num(seller[0].rating_count),
          }
        : null,
      has_phone: Boolean(rows[0].phone_override) || true,
    };
  });

export const incrementView = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
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

export const statsHome = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql.query<{ listings: number; cities: number }>(
    `select
       (select count(*)::int from listings where status = 'ACTIVE' and (expires_at is null or expires_at > now())) as listings,
       (select count(distinct city)::int from listings where status = 'ACTIVE' and (expires_at is null or expires_at > now())) as cities`,
  );
  return rows[0] ?? { listings: 0, cities: 0 };
});

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

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
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
    return settings;
  } catch {
    return SETTING_DEFAULTS;
  }
});
