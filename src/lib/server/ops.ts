import { getSql } from "@/lib/db";
import { asJson, num } from "@/lib/utils";
import { parseSearch, toFilters, type CatalogSearch } from "@/lib/search-params";
import { notify, subtreeIds } from "./helpers";

export type AlertListing = {
  id: string;
  slug: string;
  user_id: string;
  title: string;
  description: string;
  category_id: string;
  city: string | null;
  district: string | null;
  neighborhood: string | null;
  price: number;
  attrs: Record<string, string | number>;
};

function parseFilters(raw: unknown, query?: string): CatalogSearch {
  let base: CatalogSearch = {};
  if (typeof raw === "string") {
    try {
      base = parseSearch(JSON.parse(raw) as Record<string, unknown>);
    } catch {
      base = {};
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    base = parseSearch(raw as Record<string, unknown>);
  }
  if (query && !base.q) base.q = query;
  return base;
}

export async function notifySearchHits(listing: AlertListing) {
  const sql = await getSql();
  const rows = await sql.query<{ id: string; user_id: string; query: string; filters: unknown }>(
    "select id, user_id, query, filters from saved_searches where user_id <> $1",
    [listing.user_id],
  );
  const catCache = new Map<string, string[]>();
  let sent = 0;
  for (const row of rows) {
    if (sent >= 40) break;
    const f = toFilters(parseFilters(row.filters, row.query ? String(row.query) : undefined));
    if (f.q?.trim()) {
      const q = f.q.trim().toLocaleLowerCase("tr");
      const hay = `${listing.title} ${listing.description}`.toLocaleLowerCase("tr");
      if (!hay.includes(q)) continue;
    }
    if (f.category) {
      let ids = catCache.get(f.category);
      if (!ids) {
        ids = await subtreeIds(f.category);
        catCache.set(f.category, ids);
      }
      if (ids.length && !ids.includes(listing.category_id)) continue;
    }
    if (f.city && listing.city !== f.city) continue;
    if (f.district && listing.district !== f.district) continue;
    if (f.neighborhood && listing.neighborhood !== f.neighborhood) continue;
    if (f.minPrice != null && listing.price < f.minPrice) continue;
    if (f.maxPrice != null && listing.price > f.maxPrice) continue;
    const year = num(listing.attrs.Yıl, Number.NaN);
    if (f.minYear != null && Number.isFinite(year) && year < f.minYear) continue;
    if (f.maxYear != null && Number.isFinite(year) && year > f.maxYear) continue;
    const km = num(listing.attrs.KM, Number.NaN);
    if (f.minKm != null && Number.isFinite(km) && km < f.minKm) continue;
    if (f.maxKm != null && Number.isFinite(km) && km > f.maxKm) continue;
    const m2 = num(listing.attrs["m²"] ?? listing.attrs["m² (Net)"], Number.NaN);
    if (f.minM2 != null && Number.isFinite(m2) && m2 < f.minM2) continue;
    if (f.maxM2 != null && Number.isFinite(m2) && m2 > f.maxM2) continue;
    const exists = await sql.query<{ id: string }>(
      "select id from notifications where user_id=$1 and type='search' and link=$2 limit 1",
      [row.user_id, `/ilan/${listing.slug}`],
    );
    if (exists[0]) continue;
    await notify(row.user_id, "search", "Kayıtlı aramanıza uygun ilan", listing.title, `/ilan/${listing.slug}`);
    sent += 1;
  }
}

let lastSweep = 0;

export async function sweepExpiryReminders() {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  const sql = await getSql();
  const rows = await sql.query<{ user_id: string; title: string; slug: string }>(
    `select l.user_id, l.title, l.slug
     from listings l
     where l.status = 'ACTIVE'
       and l.expires_at is not null
       and l.expires_at > now()
       and l.expires_at < now() + interval '3 days'
       and not exists (
         select 1 from notifications n
         where n.user_id = l.user_id and n.type = 'expiry' and n.link = '/ilan/' || l.slug
           and n.created_at > now() - interval '25 days'
       )
     limit 30`,
  );
  for (const r of rows) {
    await notify(
      r.user_id,
      "expiry",
      "İlanınızın süresi dolmak üzere",
      `${r.title} — İlanlarım’dan 30 gün uzatabilirsiniz.`,
      `/ilan/${r.slug}`,
    );
  }
}

export function listingFromRow(row: Record<string, unknown>, userId: string): AlertListing {
  return {
    id: String(row.id),
    slug: String(row.slug),
    user_id: userId,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    category_id: String(row.category_id),
    city: row.city ? String(row.city) : null,
    district: row.district ? String(row.district) : null,
    neighborhood: row.neighborhood ? String(row.neighborhood) : null,
    price: num(row.price),
    attrs: asJson<Record<string, string | number>>(row.attrs, {}),
  };
}
