export type CatalogSearch = {
  q?: string;
  category?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  minYear?: string;
  maxYear?: string;
  minKm?: string;
  maxKm?: string;
  minM2?: string;
  maxM2?: string;
  attrs?: string;
  /** "1": only ACİL listings (home "Acil satılık" rail → Tümü). */
  urgent?: string;
  /** "1": only showcase (vitrin) listings. */
  featured?: string;
  /** "1" | "3" | "7" | "30": only listings posted in the last N days. */
  postedWithin?: "1" | "3" | "7" | "30";
  /** "1": only listings with at least one photo. */
  withPhotos?: string;
  /** "owner" | "store": filter by individual seller vs corporate store. */
  sellerType?: "owner" | "store";
  /** "1": only listings with a recent price drop. */
  priceDropped?: string;
  nearLat?: string;
  nearLng?: string;
  maxDistanceKm?: string;
};

type SearchCategoryNode = { id: string; parent_id: string | null };

/**
 * Find the category level that lets a text search continue through the same
 * taxonomy as category browsing. One matched leaf opens at its parent so its
 * siblings (for example, model variants) remain selectable.
 */
export function inferSearchCategoryId(
  resultCategoryIds: readonly string[],
  categories: readonly SearchCategoryNode[],
): string | undefined {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const ids = [...new Set(resultCategoryIds)].filter((id) => byId.has(id));
  if (ids.length === 0) return undefined;

  const paths = ids.map((id) => {
    const path: string[] = [];
    let current = byId.get(id);
    while (current) {
      path.unshift(current.id);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return path;
  });

  const commonPath: string[] = [];
  const shortestPathLength = Math.min(...paths.map((path) => path.length));
  for (let i = 0; i < shortestPathLength; i += 1) {
    const candidate = paths[0][i];
    if (paths.every((path) => path[i] === candidate)) commonPath.push(candidate);
    else break;
  }

  if (paths.length === 1 && commonPath.length > 1) {
    return commonPath[commonPath.length - 2];
  }
  return commonPath[commonPath.length - 1];
}

const POSTED_WITHIN = ["1", "3", "7", "30"] as const;
const SELLER_TYPES = ["owner", "store"] as const;

export function parseSearch(s: Record<string, unknown>): CatalogSearch {
  // The router parses "?page=2" into a number, so numbers are as valid as strings.
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : typeof s[k] === "number" ? String(s[k]) : undefined);
  const rawPostedWithin = str("postedWithin");
  const rawSellerType = str("sellerType");
  return {
    q: str("q"),
    category: str("category"),
    city: str("city"),
    district: str("district"),
    neighborhood: str("neighborhood"),
    minPrice: str("minPrice"),
    maxPrice: str("maxPrice"),
    sort: str("sort"),
    page: str("page"),
    minYear: str("minYear"),
    maxYear: str("maxYear"),
    minKm: str("minKm"),
    maxKm: str("maxKm"),
    minM2: str("minM2"),
    maxM2: str("maxM2"),
    attrs: str("attrs"),
    urgent: s.urgent === "1" || s.urgent === 1 || s.urgent === true ? "1" : undefined,
    featured: s.featured === "1" || s.featured === 1 || s.featured === true ? "1" : undefined,
    postedWithin: POSTED_WITHIN.find((d) => d === rawPostedWithin),
    withPhotos: s.withPhotos === "1" || s.withPhotos === 1 || s.withPhotos === true ? "1" : undefined,
    sellerType: SELLER_TYPES.find((t) => t === rawSellerType),
    priceDropped: s.priceDropped === "1" || s.priceDropped === 1 || s.priceDropped === true ? "1" : undefined,
    nearLat: str("nearLat"),
    nearLng: str("nearLng"),
    maxDistanceKm: str("maxDistanceKm"),
  };
}

export function parseAttrs(raw?: string): Record<string, string[]> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.map(String).filter(Boolean);
      else if (typeof v === "string" && v) out[k] = [v];
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

/** Same result as the database's tr_fold(): case and Turkish letters do not matter when searching. */
export function foldTr(text: string): string {
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .replace(/\u0307/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u");
}

const SORTS = ["date_desc", "date_asc", "price_asc", "price_desc", "views_desc", "distance"] as const;

export function toFilters(s: CatalogSearch) {
  // Links can hold anything: bad values fall back to defaults instead of failing the page.
  const n = (v?: string) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : undefined);
  const coord = (v?: string, min = -180, max = 180) => {
    if (!v) return undefined;
    const num = Number(v);
    return Number.isFinite(num) && num >= min && num <= max ? num : undefined;
  };
  const nearLat = coord(s.nearLat, -90, 90);
  const nearLng = coord(s.nearLng, -180, 180);
  const maxDistanceKm = n(s.maxDistanceKm);
  const page = Math.trunc(n(s.page) ?? 1);
  const postedWithin = POSTED_WITHIN.find((d) => d === s.postedWithin);
  const sellerType = SELLER_TYPES.find((t) => t === s.sellerType);
  return {
    q: s.q,
    category: s.category,
    city: s.city,
    district: s.district,
    neighborhood: s.neighborhood,
    minPrice: n(s.minPrice),
    maxPrice: n(s.maxPrice),
    sort: SORTS.find((sort) => sort === s.sort) ?? "date_desc",
    page: page >= 1 ? page : 1,
    minYear: n(s.minYear),
    maxYear: n(s.maxYear),
    minKm: n(s.minKm),
    maxKm: n(s.maxKm),
    minM2: n(s.minM2),
    maxM2: n(s.maxM2),
    attrs: parseAttrs(s.attrs),
    urgent: s.urgent === "1" || undefined,
    featured: s.featured === "1" || undefined,
    postedWithin: postedWithin ? Number(postedWithin) : undefined,
    withPhotos: s.withPhotos === "1" || undefined,
    sellerType,
    priceDropped: s.priceDropped === "1" || undefined,
    ...(nearLat != null && nearLng != null
      ? {
          nearLat,
          nearLng,
          ...(maxDistanceKm && maxDistanceKm >= 1 && maxDistanceKm <= 500 ? { maxDistanceKm } : {}),
        }
      : {}),
    limit: 20,
  };
}

export function attrsToSearch(attrs: Record<string, string[]>) {
  const cleaned: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(attrs)) {
    const next = v.filter(Boolean);
    if (next.length) cleaned[k] = next;
  }
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : undefined;
}

/** Min above max can only mean a slip: swap them rather than show nothing without a reason. */
export function normalizeFilterRanges<
  T extends {
    minPrice?: string;
    maxPrice?: string;
    minYear?: string;
    maxYear?: string;
    minKm?: string;
    maxKm?: string;
    minM2?: string;
    maxM2?: string;
  },
>(value: T): T {
  let next = value;
  for (const [min, max] of [
    ["minPrice", "maxPrice"],
    ["minYear", "maxYear"],
    ["minKm", "maxKm"],
    ["minM2", "maxM2"],
  ] as const) {
    const low = next[min];
    const high = next[max];
    if (low && high && Number(low) > Number(high)) {
      if (next === value) next = { ...value };
      next[min] = high;
      next[max] = low;
    }
  }
  return next;
}
