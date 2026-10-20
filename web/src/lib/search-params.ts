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
    urgent: s.urgent === "1" || s.urgent === 1 || s.urgent === true ? "1" : undefined,
    featured: s.featured === "1" || s.featured === 1 || s.featured === true ? "1" : undefined,
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
    urgent: s.urgent === "1" || undefined,
    featured: s.featured === "1" || undefined,
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
