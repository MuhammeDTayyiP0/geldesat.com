import type { AttrDef, SearchFilters, SortKey } from '@/api/types';

/** Filter state as edited on screen (numbers kept as typed strings). */
export type FilterState = {
  q?: string;
  category?: string;
  categoryName?: string;
  city?: string;
  district?: string;
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
  attrs: Record<string, string[]>;
};

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'date_desc', label: 'En yeni' },
  { value: 'date_asc', label: 'En eski' },
  { value: 'price_asc', label: 'Fiyat: düşükten yükseğe' },
  { value: 'price_desc', label: 'Fiyat: yüksekten düşüğe' },
  { value: 'views_desc', label: 'En çok görüntülenen' },
];

const num = (v?: string) => {
  const digits = v?.replace(/\D/g, '');
  return digits ? Number(digits) : undefined;
};

export function toSearchFilters(state: FilterState, page: number, limit: number): SearchFilters {
  const attrs = Object.fromEntries(Object.entries(state.attrs).filter(([, v]) => v.length));
  return {
    q: state.q?.trim() || undefined,
    category: state.category || undefined,
    city: state.city || undefined,
    district: state.district || undefined,
    minPrice: num(state.minPrice),
    maxPrice: num(state.maxPrice),
    minYear: num(state.minYear),
    maxYear: num(state.maxYear),
    minKm: num(state.minKm),
    maxKm: num(state.maxKm),
    minM2: num(state.minM2),
    maxM2: num(state.maxM2),
    sort: state.sort,
    urgent: state.urgent || undefined,
    featured: state.featured || undefined,
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
  if (state.minPrice || state.maxPrice) n++;
  if (state.minYear || state.maxYear) n++;
  if (state.minKm || state.maxKm) n++;
  if (state.minM2 || state.maxM2) n++;
  if (state.urgent) n++;
  if (state.featured) n++;
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
