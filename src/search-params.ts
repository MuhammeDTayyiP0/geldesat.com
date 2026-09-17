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
};

export function parseSearch(s: Record<string, unknown>): CatalogSearch {
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : undefined);
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
  };
}

function parseAttrs(raw?: string): Record<string, string[]> | undefined {
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

export function toFilters(s: CatalogSearch) {
  const n = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);
  return {
    q: s.q,
    category: s.category,
    city: s.city,
    district: s.district,
    neighborhood: s.neighborhood,
    minPrice: n(s.minPrice),
    maxPrice: n(s.maxPrice),
    sort: (s.sort as "date_desc" | "date_asc" | "price_asc" | "price_desc" | "views_desc") || "date_desc",
    page: n(s.page) || 1,
    minYear: n(s.minYear),
    maxYear: n(s.maxYear),
    minKm: n(s.minKm),
    maxKm: n(s.maxKm),
    minM2: n(s.minM2),
    maxM2: n(s.maxM2),
    attrs: parseAttrs(s.attrs),
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