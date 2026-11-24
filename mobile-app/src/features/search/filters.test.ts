/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AttrDef } from '@/api/types';
import {
  activeFilterCount,
  hasAreaFilter,
  hasVehicleFilters,
  normalizeFilterRanges,
  optionAttributes,
  toSearchFilters,
  withoutCategory,
  type FilterState,
} from '@/features/search/filters';

const baseState = (overrides: Partial<FilterState> = {}): FilterState => ({
  attrs: {},
  ...overrides,
});

describe('normalizeFilterRanges', () => {
  it('swaps inverted min/max numeric pairs including formatted strings', () => {
    const input = baseState({
      minPrice: '500.000',
      maxPrice: '100.000',
      minYear: '2022',
      maxYear: '2018',
      minKm: '150000',
      maxKm: '50000',
      minM2: '120',
      maxM2: '80',
    });

    const normalized = normalizeFilterRanges(input);
    assert.notStrictEqual(normalized, input);
    assert.equal(normalized.minPrice, '100.000');
    assert.equal(normalized.maxPrice, '500.000');
    assert.equal(normalized.minYear, '2018');
    assert.equal(normalized.maxYear, '2022');
    assert.equal(normalized.minKm, '50000');
    assert.equal(normalized.maxKm, '150000');
    assert.equal(normalized.minM2, '80');
    assert.equal(normalized.maxM2, '120');
  });

  it('returns the original reference when ranges are already ordered or partial', () => {
    const ordered = baseState({ minPrice: '100', maxPrice: '500', minYear: '2020' });
    assert.strictEqual(normalizeFilterRanges(ordered), ordered);
  });
});

describe('withoutCategory', () => {
  it('clears category and category-specific filters while preserving general filters', () => {
    const input = baseState({
      q: 'sedan',
      category: 'otomobil',
      categoryName: 'Otomobil',
      city: 'İstanbul',
      district: 'Kadıköy',
      neighborhood: 'Moda',
      minPrice: '300000',
      maxPrice: '900000',
      minYear: '2019',
      maxYear: '2023',
      minKm: '10000',
      maxKm: '80000',
      minM2: '90',
      maxM2: '140',
      sort: 'price_asc',
      urgent: true,
      featured: true,
      postedWithin: '7',
      withPhotos: true,
      sellerType: 'owner',
      priceDropped: true,
      attrs: { yakit: ['Benzin'] },
    });

    const cleared = withoutCategory(input);
    assert.equal(cleared.category, undefined);
    assert.equal(cleared.categoryName, undefined);
    assert.deepEqual(cleared.attrs, {});
    assert.equal(cleared.minYear, undefined);
    assert.equal(cleared.maxYear, undefined);
    assert.equal(cleared.minKm, undefined);
    assert.equal(cleared.maxKm, undefined);
    assert.equal(cleared.minM2, undefined);
    assert.equal(cleared.maxM2, undefined);

    assert.equal(cleared.q, 'sedan');
    assert.equal(cleared.city, 'İstanbul');
    assert.equal(cleared.district, 'Kadıköy');
    assert.equal(cleared.neighborhood, 'Moda');
    assert.equal(cleared.minPrice, '300000');
    assert.equal(cleared.maxPrice, '900000');
    assert.equal(cleared.sort, 'price_asc');
    assert.equal(cleared.urgent, true);
    assert.equal(cleared.featured, true);
    assert.equal(cleared.postedWithin, '7');
    assert.equal(cleared.withPhotos, true);
    assert.equal(cleared.sellerType, 'owner');
    assert.equal(cleared.priceDropped, true);
  });
});

describe('toSearchFilters', () => {
  it('serializes trimmed text, ordered numeric ranges, non-empty attrs, and pagination', () => {
    const filters = toSearchFilters(
      baseState({
        q: '  bisiklet  ',
        category: 'spor',
        city: 'Ankara',
        neighborhood: '  Bahçelievler ',
        minPrice: '5.000',
        maxPrice: '1.500',
        minYear: '2020',
        sort: 'date_desc',
        urgent: true,
        withPhotos: false,
        sellerType: 'store',
        attrs: { renk: ['Kırmızı'], bos: [] },
      }),
      2,
      24,
    );

    assert.deepEqual(filters, {
      q: 'bisiklet',
      category: 'spor',
      city: 'Ankara',
      district: undefined,
      neighborhood: 'Bahçelievler',
      minPrice: 1500,
      maxPrice: 5000,
      minYear: 2020,
      maxYear: undefined,
      minKm: undefined,
      maxKm: undefined,
      minM2: undefined,
      maxM2: undefined,
      sort: 'date_desc',
      urgent: true,
      featured: undefined,
      postedWithin: undefined,
      withPhotos: undefined,
      sellerType: 'store',
      priceDropped: undefined,
      attrs: { renk: ['Kırmızı'] },
      page: 2,
      limit: 24,
    });
  });

  it('omits empty strings and empty attrs object', () => {
    const filters = toSearchFilters(baseState({ q: '   ', neighborhood: '  ', attrs: { empty: [] } }), 1, 20);
    assert.equal(filters.q, undefined);
    assert.equal(filters.neighborhood, undefined);
    assert.equal(filters.attrs, undefined);
  });
});

describe('activeFilterCount', () => {
  it('excludes query, category, sort, and empty values from the count', () => {
    assert.equal(
      activeFilterCount(
        baseState({
          q: 'telefon',
          category: 'elektronik',
          categoryName: 'Elektronik',
          sort: 'price_desc',
          neighborhood: '   ',
          attrs: { depolama: [] },
        }),
      ),
      0,
    );
  });

  it('counts each active filter group and non-empty attribute key', () => {
    assert.equal(
      activeFilterCount(
        baseState({
          city: 'İzmir',
          district: 'Konak',
          neighborhood: 'Alsancak',
          minPrice: '100',
          maxPrice: '500',
          minYear: '2020',
          maxKm: '100000',
          minM2: '50',
          urgent: true,
          featured: true,
          postedWithin: '3',
          withPhotos: true,
          sellerType: 'owner',
          priceDropped: true,
          attrs: { vites: ['Otomatik'], yakit: ['Hybrid'], bos: [] },
        }),
      ),
      15,
    );
  });
});

describe('attribute helpers', () => {
  const sampleAttrs: AttrDef[] = [
    { id: '1', name: 'Yıl', type: 'NUMBER', options: null, unit: null, required: true },
    { id: '2', name: 'KM', type: 'NUMBER', options: null, unit: 'km', required: false },
    { id: '3', name: 'Net Alan', type: 'NUMBER', options: null, unit: 'm²', required: false },
    { id: '4', name: 'Vites', type: 'SELECT', options: ['Manuel', 'Otomatik'], unit: null, required: true },
    { id: '5', name: 'Takas', type: 'BOOLEAN', options: null, unit: null, required: false },
    { id: '6', name: 'Renk', type: 'MULTI', options: ['Siyah', 'Beyaz'], unit: null, required: false },
    { id: '7', name: 'Açıklama Notu', type: 'TEXT', options: null, unit: null, required: false },
  ];

  it('detects vehicle and area filters and extracts option attributes', () => {
    assert.equal(hasVehicleFilters(sampleAttrs), true);
    assert.equal(hasVehicleFilters([sampleAttrs[3]]), false);

    assert.equal(hasAreaFilter(sampleAttrs), true);
    assert.equal(hasAreaFilter([{ id: '8', name: 'Arsa m²', type: 'NUMBER', options: null, unit: null, required: false }]), true);
    assert.equal(hasAreaFilter([sampleAttrs[3]]), false);

    assert.deepEqual(
      optionAttributes(sampleAttrs).map((a) => a.name),
      ['Vites', 'Takas', 'Renk'],
    );
  });
});
