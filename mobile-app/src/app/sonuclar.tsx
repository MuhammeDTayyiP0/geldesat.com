import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Bell, Bookmark, ChevronLeft, LayoutGrid, List, Search, SearchX, SlidersHorizontal, X } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { catalog, savedSearches } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { SavedSearchFilters, SortKey } from '@/api/types';
import { useRequireAuth } from '@/auth/useRequireAuth';
import { ListingGrid } from '@/features/listing/ListingGrid';
import { FilterSheet } from '@/features/search/FilterSheet';
import {
  POSTED_WITHIN_OPTIONS,
  SELLER_TYPE_OPTIONS,
  SORTS,
  activeFilterCount,
  toSearchFilters,
  withoutCategory,
  type FilterState,
} from '@/features/search/filters';
import { useFlag } from '@/lib/flags';
import { formatNumber, uniqueById } from '@/lib/format';
import { rememberSearch } from '@/lib/storage';
import { Button, Chip, EmptyState, ErrorState, IconButton, Input, ListRow, RowGroup, Sheet, Text, font, hairline, radius, space, toast, useTheme } from '@/ui';

const LIMIT = 24;

type Params = {
  q?: string;
  category?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  minPrice?: string;
  maxPrice?: string;
  urgent?: string;
  featured?: string;
  postedWithin?: string;
  withPhotos?: string;
  sellerType?: string;
  priceDropped?: string;
  title?: string;
  sort?: string;
};

function filtersFromParams(params: Params): FilterState {
  const postedWithin = POSTED_WITHIN_OPTIONS.some((o) => o.value === params.postedWithin)
    ? (params.postedWithin as FilterState['postedWithin'])
    : undefined;
  const sellerType = SELLER_TYPE_OPTIONS.some((o) => o.value === params.sellerType)
    ? (params.sellerType as FilterState['sellerType'])
    : undefined;
  return {
    q: params.q,
    category: params.category,
    city: params.city,
    district: params.district,
    neighborhood: params.neighborhood,
    minPrice: params.minPrice?.replace(/\D/g, '') || undefined,
    maxPrice: params.maxPrice?.replace(/\D/g, '') || undefined,
    urgent: params.urgent === '1',
    featured: params.featured === '1',
    postedWithin,
    withPhotos: params.withPhotos === '1',
    sellerType,
    priceDropped: params.priceDropped === '1',
    sort: (SORTS.some((s) => s.value === params.sort) ? params.sort : 'date_desc') as SortKey,
    attrs: {},
  };
}

export default function ResultsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const kayitliAramalar = useFlag('kayitli_aramalar');
  const params = useLocalSearchParams<Params>();
  const [filters, setFilters] = useState<FilterState>(() => filtersFromParams(params));
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sheet, setSheet] = useState<'filters' | 'sort' | 'save' | null>(null);
  const [query, setQuery] = useState(params.q ?? '');
  const [saveName, setSaveName] = useState('');
  const [saveNotify, setSaveNotify] = useState(true);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    setFilters(
      filtersFromParams({
        q: params.q,
        category: params.category,
        city: params.city,
        district: params.district,
        neighborhood: params.neighborhood,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        urgent: params.urgent,
        featured: params.featured,
        postedWithin: params.postedWithin,
        withPhotos: params.withPhotos,
        sellerType: params.sellerType,
        priceDropped: params.priceDropped,
        sort: params.sort,
      }),
    );
    setQuery(params.q ?? '');
  }, [
    params.q,
    params.category,
    params.city,
    params.district,
    params.neighborhood,
    params.minPrice,
    params.maxPrice,
    params.urgent,
    params.featured,
    params.postedWithin,
    params.withPhotos,
    params.sellerType,
    params.priceDropped,
    params.sort,
  ]);

  const info = useQuery({
    queryKey: keys.category(filters.category ?? ''),
    queryFn: () => catalog.category(filters.category ?? ''),
    enabled: !!filters.category,
    staleTime: 10 * 60_000,
  });

  const searchKey = useMemo(() => toSearchFilters(filters, 1, LIMIT), [filters]);
  const results = useInfiniteQuery({
    queryKey: keys.search(searchKey),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => catalog.search(toSearchFilters(filters, pageParam, LIMIT)),
    getNextPageParam: (last) => (last.result.page < last.result.pages ? last.result.page + 1 : undefined),
  });
  // New listings shift later pages, so the same listing can come twice; the list keys need one each.
  const listings = useMemo(() => uniqueById(results.data?.pages.flatMap((p) => p.result.listings) ?? []), [results.data]);
  const total = results.data?.pages[0]?.result.total;
  const inferred = results.data?.pages[0]?.inferredCategorySlug;
  const inferredInfo = useQuery({
    queryKey: keys.category(inferred ?? ''),
    queryFn: () => catalog.category(inferred ?? ''),
    enabled: !!inferred && !filters.category,
    staleTime: 10 * 60_000,
  });

  const categoryName = filters.categoryName ?? info.data?.category?.name;
  const title = filters.q ? undefined : (params.title ?? categoryName ?? 'Tüm ilanlar');
  const filterCount = activeFilterCount(filters);
  const subcategories = info.data?.children ?? [];

  const submitQuery = () => {
    const q = query.trim();
    if (q) void rememberSearch(q);
    setFilters((f) => ({ ...f, q: q || undefined }));
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const extraFilters: SavedSearchFilters = {};
      if (searchKey.neighborhood) extraFilters.neighborhood = searchKey.neighborhood;
      if (searchKey.minYear != null) extraFilters.minYear = searchKey.minYear;
      if (searchKey.maxYear != null) extraFilters.maxYear = searchKey.maxYear;
      if (searchKey.minKm != null) extraFilters.minKm = searchKey.minKm;
      if (searchKey.maxKm != null) extraFilters.maxKm = searchKey.maxKm;
      if (searchKey.minM2 != null) extraFilters.minM2 = searchKey.minM2;
      if (searchKey.maxM2 != null) extraFilters.maxM2 = searchKey.maxM2;
      if (searchKey.sort && searchKey.sort !== 'date_desc') extraFilters.sort = searchKey.sort;
      if (searchKey.urgent) extraFilters.urgent = true;
      if (searchKey.featured) extraFilters.featured = true;
      if (searchKey.postedWithin) extraFilters.postedWithin = searchKey.postedWithin;
      if (searchKey.withPhotos) extraFilters.withPhotos = true;
      if (searchKey.sellerType) extraFilters.sellerType = searchKey.sellerType;
      if (searchKey.priceDropped) extraFilters.priceDropped = true;

      return savedSearches.create({
        name: saveName.trim(),
        category_slug: searchKey.category ?? null,
        city: searchKey.city ?? null,
        district: searchKey.district ?? null,
        q: searchKey.q ?? null,
        min_price: searchKey.minPrice ?? null,
        max_price: searchKey.maxPrice ?? null,
        filters: Object.keys(extraFilters).length ? extraFilters : undefined,
        notify: saveNotify,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.savedSearches });
      toast.success('Arama kaydedildi');
      setSheet(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const openSaveSheet = () => {
    if (!requireAuth('Aramayı kaydetmek için giriş yapın.')) return;
    const baseName = filters.q || params.title || categoryName || filters.city || 'Kayıtlı arama';
    setSaveName(baseName.trim().slice(0, 80) || 'Kayıtlı arama');
    setSaveNotify(true);
    setSheet('save');
  };

  const header = (
    <View style={styles.listHeader}>
      {subcategories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {subcategories.map((sub) => (
            <Chip
              key={sub.id}
              label={sub.name}
              onPress={() => setFilters((f) => ({ ...f, category: sub.slug, categoryName: sub.name, attrs: {} }))}
            />
          ))}
        </ScrollView>
      ) : null}
      {inferredInfo.data?.category && !filters.category ? (
        <Pressable
          onPress={() =>
            setFilters((f) => ({ ...f, category: inferredInfo.data?.category?.slug, categoryName: inferredInfo.data?.category?.name }))
          }
          style={[styles.inferred, { backgroundColor: c.primarySoft }]}
        >
          <LayoutGrid size={16} color={c.primary} />
          <Text variant="caption" tone="primary" style={styles.flex}>
            Sonuçlar çoğunlukla <Text variant="label" tone="primary">{inferredInfo.data.category.name}</Text> kategorisinde. Filtrelerini görmek
            için dokunun.
          </Text>
        </Pressable>
      ) : null}
      {total != null ? (
        <Text variant="caption" tone="muted" style={styles.count}>
          {total ? `${formatNumber(total)} ilan bulundu` : ''}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.xs, backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.searchRow}>
          <IconButton icon={ChevronLeft} label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={[styles.field, { backgroundColor: c.elevated }]}>
            <Search size={18} color={c.subtle} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={title ? `${title} içinde ara` : 'Ara'}
              placeholderTextColor={c.subtle}
              returnKeyType="search"
              onSubmitEditing={submitQuery}
              style={[styles.input, { color: c.fg }]}
              accessibilityLabel="Arama"
            />
            {query ? (
              <Pressable
                hitSlop={8}
                accessibilityLabel="Aramayı temizle"
                onPress={() => {
                  setQuery('');
                  setFilters((f) => ({ ...f, q: undefined }));
                }}
              >
                <X size={16} color={c.subtle} />
              </Pressable>
            ) : null}
          </View>
          <IconButton
            icon={layout === 'grid' ? List : LayoutGrid}
            label={layout === 'grid' ? 'Liste görünümü' : 'Izgara görünümü'}
            onPress={() => setLayout((l) => (l === 'grid' ? 'list' : 'grid'))}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip
            icon={SlidersHorizontal}
            label={filterCount ? `Filtrele (${filterCount})` : 'Filtrele'}
            selected={filterCount > 0}
            onPress={() => setSheet('filters')}
          />
          <Chip
            icon={ArrowUpDown}
            label={SORTS.find((s) => s.value === filters.sort)?.label ?? 'Sırala'}
            onPress={() => setSheet('sort')}
          />
          {kayitliAramalar ? <Chip icon={Bookmark} label="Aramayı kaydet" onPress={openSaveSheet} /> : null}
          {filters.category ? (
            <Chip
              label={categoryName ?? 'Kategori'}
              selected
              onRemove={() => setFilters(withoutCategory)}
            />
          ) : null}
          {filters.city ? (
            <Chip
              label={filters.district ? `${filters.district}, ${filters.city}` : filters.city}
              selected
              onRemove={() => setFilters((f) => ({ ...f, city: undefined, district: undefined, neighborhood: undefined }))}
            />
          ) : null}
          {filters.neighborhood ? (
            <Chip label={filters.neighborhood} selected onRemove={() => setFilters((f) => ({ ...f, neighborhood: undefined }))} />
          ) : null}
          {filters.postedWithin ? (
            <Chip
              label={POSTED_WITHIN_OPTIONS.find((o) => o.value === filters.postedWithin)?.label ?? filters.postedWithin}
              selected
              onRemove={() => setFilters((f) => ({ ...f, postedWithin: undefined }))}
            />
          ) : null}
          {filters.sellerType ? (
            <Chip
              label={SELLER_TYPE_OPTIONS.find((o) => o.value === filters.sellerType)?.label ?? filters.sellerType}
              selected
              onRemove={() => setFilters((f) => ({ ...f, sellerType: undefined }))}
            />
          ) : null}
          {filters.urgent ? <Chip label="Acil" selected onRemove={() => setFilters((f) => ({ ...f, urgent: false }))} /> : null}
          {filters.featured ? <Chip label="Vitrin" selected onRemove={() => setFilters((f) => ({ ...f, featured: false }))} /> : null}
          {filters.withPhotos ? <Chip label="Fotoğraflı" selected onRemove={() => setFilters((f) => ({ ...f, withPhotos: false }))} /> : null}
          {filters.priceDropped ? <Chip label="Fiyatı düşen" selected onRemove={() => setFilters((f) => ({ ...f, priceDropped: false }))} /> : null}
        </ScrollView>
      </View>

      <ListingGrid
          bottomInset={insets.bottom}
        listings={listings}
        layout={layout}
        loading={results.isLoading}
        header={header}
        refreshing={results.isRefetching && !results.isFetchingNextPage}
        onRefresh={() => results.refetch()}
        onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
        loadingMore={results.isFetchingNextPage}
        loadMoreError={results.isFetchNextPageError}
        onRetryMore={() => void results.fetchNextPage()}
        empty={
          results.isError && !results.data ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : (
            <EmptyState
              icon={SearchX}
              title="Sonuç bulunamadı"
              message="Filtreleri azaltmayı veya farklı bir kelimeyle aramayı deneyin."
              action={
                filterCount || filters.q ? (
                  <Button
                    title="Filtreleri temizle"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      setQuery('');
                      setFilters((f) => ({ category: f.category, categoryName: f.categoryName, sort: f.sort, attrs: {} }));
                    }}
                  />
                ) : undefined
              }
            />
          )
        }
      />

      <FilterSheet visible={sheet === 'filters'} onClose={() => setSheet(null)} value={filters} onApply={setFilters} />
      <Sheet visible={sheet === 'sort'} onClose={() => setSheet(null)} title="Sırala">
        <RowGroup>
          {SORTS.map((s) => (
            <ListRow
              key={s.value}
              label={s.label}
              checked={filters.sort === s.value}
              onPress={() => {
                setFilters((f) => ({ ...f, sort: s.value }));
                setSheet(null);
              }}
            />
          ))}
        </RowGroup>
      </Sheet>
      <Sheet
        visible={sheet === 'save'}
        onClose={() => setSheet(null)}
        title="Aramayı kaydet"
        subtitle="Bu kriterlere uyan yeni ilanlar için bildirim alın"
      >
        <Input
          label="Arama adı"
          value={saveName}
          onChangeText={setSaveName}
          placeholder="Örn. İstanbul iPhone 15"
          maxLength={80}
          returnKeyType="done"
          onSubmitEditing={() => saveName.trim() && !saveMutation.isPending && saveMutation.mutate()}
        />
        <RowGroup>
          <ListRow
            icon={Bell}
            label="Yeni ilan bildirimi"
            detail="Eşleşen yeni ilanlar yayınlandığında bildir"
            switchValue={saveNotify}
            onSwitch={setSaveNotify}
          />
        </RowGroup>
        <Button
          title="Kaydet"
          icon={Bookmark}
          loading={saveMutation.isPending}
          disabled={!saveName.trim()}
          onPress={() => saveMutation.mutate()}
          block
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { borderBottomWidth: hairline, paddingBottom: space.sm, gap: space.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs, gap: space.xs },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 42, borderRadius: radius.md, paddingHorizontal: space.md },
  input: { flex: 1, fontSize: font.md, height: 42 },
  chipRow: { paddingHorizontal: space.lg, gap: space.sm },
  listHeader: { gap: space.md, paddingTop: space.md, marginHorizontal: -space.md },
  inferred: { marginHorizontal: space.lg, flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, alignItems: 'center' },
  count: { paddingHorizontal: space.lg },
});
