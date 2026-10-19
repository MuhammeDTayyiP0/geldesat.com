import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Check, ChevronLeft, LayoutGrid, List, Search, SearchX, SlidersHorizontal, X } from 'lucide-react-native';
import { catalog } from '@/api/endpoints';
import { keys } from '@/api/queries';
import type { SortKey } from '@/api/types';
import { ListingGrid } from '@/features/listing/ListingGrid';
import { FilterSheet } from '@/features/search/FilterSheet';
import { SORTS, activeFilterCount, toSearchFilters, type FilterState } from '@/features/search/filters';
import { formatNumber } from '@/lib/format';
import { rememberSearch } from '@/lib/storage';
import { Button, Chip, EmptyState, ErrorState, IconButton, ListRow, RowGroup, Sheet, Text, font, hairline, radius, space, useTheme } from '@/ui';

const LIMIT = 24;

type Params = {
  q?: string;
  category?: string;
  city?: string;
  district?: string;
  urgent?: string;
  featured?: string;
  title?: string;
  sort?: string;
};

export default function ResultsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const [filters, setFilters] = useState<FilterState>(() => ({
    q: params.q,
    category: params.category,
    city: params.city,
    district: params.district,
    urgent: params.urgent === '1',
    featured: params.featured === '1',
    sort: (SORTS.some((s) => s.value === params.sort) ? params.sort : 'date_desc') as SortKey,
    attrs: {},
  }));
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null);
  const [query, setQuery] = useState(params.q ?? '');

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
  const listings = useMemo(() => results.data?.pages.flatMap((p) => p.result.listings) ?? [], [results.data]);
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
          <IconButton icon={ChevronLeft} label="Geri" onPress={() => router.back()} />
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
          {filters.category ? (
            <Chip
              label={categoryName ?? 'Kategori'}
              selected
              onRemove={() => setFilters((f) => ({ ...f, category: undefined, categoryName: undefined, attrs: {} }))}
            />
          ) : null}
          {filters.city ? (
            <Chip
              label={filters.district ? `${filters.district}, ${filters.city}` : filters.city}
              selected
              onRemove={() => setFilters((f) => ({ ...f, city: undefined, district: undefined }))}
            />
          ) : null}
          {filters.urgent ? <Chip label="Acil" selected onRemove={() => setFilters((f) => ({ ...f, urgent: false }))} /> : null}
          {filters.featured ? <Chip label="Vitrin" selected onRemove={() => setFilters((f) => ({ ...f, featured: false }))} /> : null}
        </ScrollView>
      </View>

      <ListingGrid
        listings={listings}
        layout={layout}
        loading={results.isLoading}
        header={header}
        refreshing={results.isRefetching && !results.isFetchingNextPage}
        onRefresh={() => results.refetch()}
        onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
        loadingMore={results.isFetchingNextPage}
        empty={
          results.isError ? (
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
              onPress={() => {
                setFilters((f) => ({ ...f, sort: s.value }));
                setSheet(null);
              }}
              right={filters.sort === s.value ? <Check size={18} color={c.primary} /> : undefined}
            />
          ))}
        </RowGroup>
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
