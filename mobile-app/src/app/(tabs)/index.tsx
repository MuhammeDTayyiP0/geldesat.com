import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Bell, ChevronRight, Heart, LocateFixed, MapPin, Search, Sparkles } from 'lucide-react-native';
import { catalog, listings as listingsApi } from '@/api/endpoints';
import { keys, queryClient, useConfig, useCounts, useRoots } from '@/api/queries';
import { useSession } from '@/auth/session';
import { categoryIcon } from '@/features/catalog/categoryIcon';
import { ListingGrid } from '@/features/listing/ListingGrid';
import { ListingRail } from '@/features/listing/ListingRail';
import { useNearbyCity } from '@/features/location/nearby';
import { OptionPicker } from '@/features/location/OptionPicker';
import { formatNumber } from '@/lib/format';
import { CountDot, EmptyState, ErrorState, IconButton, Skeleton, Text, Wordmark, hairline, radius, space, toast, useTheme } from '@/ui';

const PAGE = 20;

export default function DiscoverScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const { data: counts } = useCounts();
  const { data: config } = useConfig();
  const roots = useRoots();
  const nearby = useNearbyCity();
  const [cityPicker, setCityPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const stats = useQuery({ queryKey: keys.stats, queryFn: catalog.stats, staleTime: 5 * 60_000 });
  const urgent = useQuery({ queryKey: keys.rail('urgent'), queryFn: () => catalog.listings({ urgent: true, limit: 12 }) });
  const featured = useQuery({ queryKey: keys.rail('featured'), queryFn: () => catalog.listings({ featured: true, limit: 12 }) });
  const near = useQuery({
    queryKey: keys.rail(`city:${nearby.city}`),
    queryFn: () => catalog.listings({ city: nearby.city ?? undefined, limit: 12 }),
    enabled: !!nearby.city,
  });
  const feed = useInfiniteQuery({
    queryKey: keys.rail('latest'),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => catalog.listings({ limit: PAGE, offset: pageParam, sort: 'date_desc' }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.listings.length, 0);
      return last.listings.length === PAGE && loaded < last.total ? loaded : undefined;
    },
  });
  // "Son baktıklarınız" comes from the account, so it is the same on the website and every device.
  const recentQuery = useQuery({
    queryKey: keys.recent,
    queryFn: listingsApi.recent,
    enabled: session.status === 'signedIn',
    select: (rows) => rows.filter((r) => r.live).slice(0, 12),
  });
  const recent = session.status === 'signedIn' ? (recentQuery.data ?? []) : [];
  const latest = useMemo(() => feed.data?.pages.flatMap((p) => p.listings) ?? [], [feed.data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rail'] }),
      queryClient.invalidateQueries({ queryKey: keys.stats }),
      queryClient.invalidateQueries({ queryKey: keys.roots }),
      queryClient.invalidateQueries({ queryKey: keys.counts }),
      queryClient.invalidateQueries({ queryKey: keys.recent }),
    ]);
    setRefreshing(false);
  }, []);

  const askLocation = async () => {
    const result = await nearby.locate();
    if (result.error) {
      toast.info(result.error);
      setCityPicker(true);
    }
  };

  const announcement = config?.mobileApp?.announcement;

  const header = (
    <View style={styles.header}>
      {announcement ? (
        <View style={[styles.announcement, { backgroundColor: c.primarySoft }]}>
          <Sparkles size={16} color={c.primary} />
          <Text variant="caption" tone="primary" style={styles.flex}>
            {announcement}
          </Text>
        </View>
      ) : null}

      <View style={styles.hero}>
        <Text variant="title">Ne arıyorsunuz?</Text>
        <Text tone="muted">
          {stats.data ? `${formatNumber(stats.data.listings)} ilan · ${formatNumber(stats.data.cities)} şehir` : 'Türkiye’nin ücretsiz ilan platformu'}
        </Text>
      </View>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel="İlan ara"
        onPress={() => router.push({ pathname: '/ara', params: { focus: '1' } })}
        style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <Search size={20} color={c.subtle} />
        <Text tone="subtle" style={styles.flex}>
          Marka, model, ürün veya ilan no
        </Text>
      </Pressable>

      <CategoryStrip loading={roots.isLoading} roots={roots.data?.roots ?? []} counts={roots.data?.counts ?? {}} />

      <ListingRail
        title="Acil satılık"
        subtitle="Sahibi hızlı satmak istiyor"
        items={urgent.data?.listings}
        loading={urgent.isLoading}
        onSeeAll={() => router.push({ pathname: '/sonuclar', params: { urgent: '1', title: 'Acil satılık' } })}
      />

      <ListingRail
        title="Vitrin"
        items={featured.data?.listings}
        loading={featured.isLoading}
        onSeeAll={() => router.push({ pathname: '/sonuclar', params: { featured: '1', title: 'Vitrin ilanları' } })}
      />

      {nearby.city ? (
        <View>
          <ListingRail
            title={`${nearby.city} civarında`}
            items={near.data?.listings}
            loading={near.isLoading}
            onSeeAll={() => router.push({ pathname: '/sonuclar', params: { city: nearby.city ?? '' } })}
          />
          <Pressable onPress={() => setCityPicker(true)} style={styles.changeCity} hitSlop={6}>
            <MapPin size={13} color={c.subtle} />
            <Text variant="small" tone="subtle">
              Şehri değiştir
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={askLocation}
          style={[styles.nearbyCard, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <View style={[styles.nearbyIcon, { backgroundColor: c.primarySoft }]}>
            <LocateFixed size={20} color={c.primary} />
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong">Yakınınızdaki ilanlar</Text>
            <Text variant="caption" tone="muted">
              {nearby.locating ? 'Konumunuz alınıyor…' : 'Konumunuzu kullanın veya şehrinizi seçin'}
            </Text>
          </View>
          <ChevronRight size={18} color={c.subtle} />
        </Pressable>
      )}

      {recent.length ? (
        <ListingRail title="Son baktıklarınız" items={recent} onSeeAll={() => router.push('/son-bakilanlar')} />
      ) : null}

      <Text variant="subheading" style={styles.feedTitle}>
        Yeni ilanlar
      </Text>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <View style={[styles.topBar, { paddingTop: insets.top, backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Wordmark />
        <View style={styles.topActions}>
          <IconButton icon={Heart} label="Favoriler" onPress={() => router.push('/favoriler')} />
          <IconButton
            icon={Bell}
            label="Bildirimler"
            onPress={() => router.push(session.status === 'signedIn' ? '/bildirimler' : '/giris')}
            badge={<CountDot count={counts?.notifications ?? 0} />}
          />
        </View>
      </View>

      <ListingGrid
        listings={latest}
        loading={feed.isLoading}
        header={header}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        loadingMore={feed.isFetchingNextPage}
        empty={
          feed.isError ? (
            <ErrorState error={feed.error} onRetry={() => feed.refetch()} compact />
          ) : (
            <EmptyState
              compact
              icon={Sparkles}
              title="Henüz ilan yok"
              message="İlk ilanı siz verin; ilan vermek ücretsiz."
            />
          )
        }
      />

      <OptionPicker
        visible={cityPicker}
        onClose={() => setCityPicker(false)}
        title="Şehrinizi seçin"
        value={nearby.city}
        onSelect={(city) => void nearby.setCity(city)}
        allLabel="Şehir seçme"
      />
    </View>
  );
}

function CategoryStrip({
  roots,
  counts,
  loading,
}: {
  roots: { id: string; name: string; slug: string; icon: string | null }[];
  counts: Record<string, number>;
  loading: boolean;
}) {
  const { c } = useTheme();
  const router = useRouter();
  if (loading) {
    return (
      <View style={styles.catRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.catItem}>
            <Skeleton width={56} height={56} rounded={18} />
            <Skeleton width={52} height={10} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.catWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        {roots.map((cat) => {
          const { icon: Icon, tint } = categoryIcon(cat.icon);
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="button"
              accessibilityLabel={`${cat.name} kategorisi`}
              onPress={() => router.push({ pathname: '/kategoriler', params: { root: cat.id } })}
              style={styles.catItem}
            >
              <View style={[styles.catIcon, { backgroundColor: `${tint}1a` }]}>
                <Icon size={26} color={tint} strokeWidth={1.9} />
              </View>
              <Text variant="small" numberOfLines={1} style={styles.catLabel}>
                {cat.name}
              </Text>
              {counts[cat.id] ? (
                <Text variant="small" tone="subtle" style={styles.catCount}>
                  {formatNumber(counts[cat.id])}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
        <Pressable onPress={() => router.push('/kategoriler')} style={styles.catItem} accessibilityRole="button">
          <View style={[styles.catIcon, { backgroundColor: c.elevated }]}>
            <ChevronRight size={24} color={c.muted} />
          </View>
          <Text variant="small" style={styles.catLabel}>
            Tümü
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    borderBottomWidth: hairline,
  },
  topActions: { flexDirection: 'row', alignItems: 'center' },
  header: { gap: space.xl, paddingTop: space.lg, marginHorizontal: -space.md, paddingBottom: space.sm },
  announcement: {
    marginHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  hero: { paddingHorizontal: space.lg, gap: 2 },
  search: {
    marginHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: -space.sm,
  },
  catWrap: { marginTop: -space.xs },
  catRow: { paddingHorizontal: space.lg, gap: space.md, flexDirection: 'row' },
  catItem: { width: 72, alignItems: 'center', gap: 6 },
  catIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  catLabel: { textAlign: 'center' },
  catCount: { marginTop: -4 },
  nearbyCard: {
    marginHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: hairline,
  },
  nearbyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  changeCity: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.lg, marginTop: space.sm },
  feedTitle: { paddingHorizontal: space.lg },
});
