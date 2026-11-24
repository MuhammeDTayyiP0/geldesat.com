import type { AttrDef, SearchFilters, SortKey } from '@/api/types';

/** Filter state as edited on screen (numbers kept as typed strings). */
export type FilterState = {
  q?: string;
  category?: string;
  categoryName?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  minKm?: string;
  maxKm?: string;
  minM2?: string;
  maxM2?: string;
  sort?: SortKey;
  urgent?: boolean;
  featured?: boolean;
  postedWithin?: '1' | '3' | '7' | '30';
  withPhotos?: boolean;
  sellerType?: 'owner' | 'store';
  priceDropped?: boolean;
  attrs: Record<string, string[]>;
};

export const POSTED_WITHIN_OPTIONS: { value: '1' | '3' | '7' | '30'; label: string }[] = [
  { value: '1', label: 'Son 24 saat' },
  { value: '3', label: 'Son 3 gün' },
  { value: '7', label: 'Son 7 gün' },
  { value: '30', label: 'Son 30 gün' },
];

export const SELLER_TYPE_OPTIONS: { value: 'owner' | 'store'; label: string }[] = [
  { value: 'owner', label: 'Sahibinden' },
  { value: 'store', label: 'Mağazadan' },
];

export const SORTS: { value: SortKey; label: string }[] = [
  // Same names as the site's sort menu.
  { value: 'date_desc', label: 'En yeni ilanlar' },
  { value: 'date_asc', label: 'En eski ilanlar' },
  { value: 'price_asc', label: 'Fiyat: düşükten yükseğe' },
  { value: 'price_desc', label: 'Fiyat: yüksekten düşüğe' },
  { value: 'views_desc', label: 'En çok incelenenler' },
];

const num = (v?: string) => {
  const digits = v?.replace(/\D/g, '');
  return digits ? Number(digits) : undefined;
};

/** "En az 500, en çok 100" means 100-500: an empty result for a reversed range helps nobody. */
function ordered(min?: string, max?: string): [number | undefined, number | undefined] {
  const a = num(min);
  const b = num(max);
  return a != null && b != null && a > b ? [b, a] : [a, b];
}

/** Swap any inverted min/max number pairs before applying filters. */
export function normalizeFilterRanges(state: FilterState): FilterState {
  let next = state;
  for (const [min, max] of [
    ['minPrice', 'maxPrice'],
    ['minYear', 'maxYear'],
    ['minKm', 'maxKm'],
    ['minM2', 'maxM2'],
  ] as const) {
    const low = num(next[min]);
    const high = num(next[max]);
    if (low != null && high != null && low > high) {
      if (next === state) next = { ...state };
      next[min] = state[max];
      next[max] = state[min];
    }
  }
  return next;
}

/** Category-specific ranges and options go with the category, so none stays as an invisible filter. */
export function withoutCategory(state: FilterState): FilterState {
  return { ...state, category: undefined, categoryName: undefined, attrs: {}, minYear: undefined, maxYear: undefined, minKm: undefined, maxKm: undefined, minM2: undefined, maxM2: undefined };
}

export function toSearchFilters(state: FilterState, page: number, limit: number): SearchFilters {
  const attrs = Object.fromEntries(Object.entries(state.attrs).filter(([, v]) => v.length));
  const [minPrice, maxPrice] = ordered(state.minPrice, state.maxPrice);
  const [minYear, maxYear] = ordered(state.minYear, state.maxYear);
  const [minKm, maxKm] = ordered(state.minKm, state.maxKm);
  const [minM2, maxM2] = ordered(state.minM2, state.maxM2);
  return {
    q: state.q?.trim() || undefined,
    category: state.category || undefined,
    city: state.city || undefined,
    district: state.district || undefined,
    neighborhood: state.neighborhood?.trim() || undefined,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    minKm,
    maxKm,
    minM2,
    maxM2,
    sort: state.sort,
    urgent: state.urgent || undefined,
    featured: state.featured || undefined,
    postedWithin: state.postedWithin || undefined,
    withPhotos: state.withPhotos || undefined,
    sellerType: state.sellerType || undefined,
    priceDropped: state.priceDropped || undefined,
    attrs: Object.keys(attrs).length ? attrs : undefined,
    page,
    limit,
  };
}

/** How many filters beyond query and category are active (for the badge). */
export function activeFilterCount(state: FilterState): number {
  let n = 0;
  if (state.city) n++;
  if (state.district) n++;
  if (state.neighborhood?.trim()) n++;
  if (state.minPrice || state.maxPrice) n++;
  if (state.minYear || state.maxYear) n++;
  if (state.minKm || state.maxKm) n++;
  if (state.minM2 || state.maxM2) n++;
  if (state.urgent) n++;
  if (state.featured) n++;
  if (state.postedWithin) n++;
  if (state.withPhotos) n++;
  if (state.sellerType) n++;
  if (state.priceDropped) n++;
  n += Object.values(state.attrs).filter((v) => v.length).length;
  return n;
}

export function hasVehicleFilters(attributes: AttrDef[]): boolean {
  return attributes.some((a) => a.name === 'Yıl' || a.name === 'KM');
}

export function hasAreaFilter(attributes: AttrDef[]): boolean {
  return attributes.some((a) => a.unit === 'm²' || a.name.includes('m²'));
}

/** Attributes offered as option filters (choices the server can match). */
export function optionAttributes(attributes: AttrDef[]): AttrDef[] {
  return attributes.filter((a) => (a.type === 'SELECT' || a.type === 'MULTI' || a.type === 'BOOLEAN') && a.name !== 'Yıl' && a.name !== 'KM');
}
