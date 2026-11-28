import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { BadgeCheck, CalendarDays, Clock, Eye, LayoutGrid, MapPin, MessageCircle, Pencil, Search, Share2, UserCheck, UserPlus, Users, UserX, X } from 'lucide-react-native';
import { ApiError, errorMessage } from '@/api/client';
import { catalog, follows, listings } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { Review, SellerResponseStats } from '@/api/types';
import { useSession } from '@/auth/session';
import { useRequireAuth } from '@/auth/useRequireAuth';
import { ListingGrid } from '@/features/listing/ListingGrid';
import { webUrl } from '@/lib/config';
import { useFlag } from '@/lib/flags';
import { formatDate, formatNumber, memberSince, uniqueById } from '@/lib/format';
import { Avatar, Badge, Button, Card, Chip, EmptyState, ErrorState, Header, IconButton, Input, Loading, Stars, Text, radius, space, toast, useTheme } from '@/ui';

function formatResponseStats(stats: SellerResponseStats | null | undefined): string | null {
  if (!stats) return null;
  const parts: string[] = [];
  if (typeof stats.responseRate === 'number' && Number.isFinite(stats.responseRate)) {
    parts.push(`%${Math.round(stats.responseRate)} yanıt`);
  }
  const mins = stats.avgReplyMinutes;
  if (typeof mins === 'number' && Number.isFinite(mins)) {
    parts.push(mins < 60 ? `~${Math.max(1, Math.round(mins))} dk` : `~${Math.round(mins / 60)} saat`);
  }
  return parts.length ? parts.join(' · ') : null;
}

export default function SellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const router = useRouter();
  const followOn = useFlag('satici_takip');
  const requireAuth = useRequireAuth();
  const query = useQuery({ queryKey: keys.seller(id), queryFn: () => listings.seller(id) });
  const seller = query.data?.seller;
  const session = useSession();
  const isOwner = session.status === 'signedIn' && session.user.id === id;
  const store = seller?.store;
  const [prevId, setPrevId] = useState(id);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [extraReviews, setExtraReviews] = useState<Review[]>([]);
  const [expandedReviews, setExpandedReviews] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewsExhausted, setReviewsExhausted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (id !== prevId) {
    setPrevId(id);
    setReviewsPage(1);
    setExtraReviews([]);
    setExpandedReviews(false);
    setReviewsExhausted(false);
    setSearchQuery('');
    setDebouncedQuery('');
    setSelectedCategory(null);
  }

  const onChangeSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) setDebouncedQuery('');
  };

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const followQuery = useQuery({
    queryKey: keys.followStatus(id),
    queryFn: () => follows.status(id),
    enabled: followOn && !!id,
  });

  const toggleFollow = useMutation({
    mutationFn: (currentlyFollowing: boolean) => (currentlyFollowing ? follows.unfollow(id) : follows.follow(id)),
    onSuccess: (res) => {
      queryClient.setQueryData(keys.followStatus(id), res);
      void queryClient.invalidateQueries({ queryKey: keys.followedSellers });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reviews = useMemo(() => uniqueById([...(seller?.reviews ?? []), ...extraReviews]), [seller?.reviews, extraReviews]);
  const responseBadge = formatResponseStats(seller?.responseStats);

  const loadMoreReviews = async () => {
    if (!seller || loadingReviews) return;
    if (!expandedReviews && reviews.length > 5 && reviews.length >= seller.rating_count) {
      setExpandedReviews(true);
      return;
    }
    setExpandedReviews(true);
    const nextPage = reviewsPage + 1;
    setLoadingReviews(true);
    try {
      const res = await listings.seller(id, 0, nextPage);
      const next = res.seller.reviews ?? [];
      if (!next.length) {
        setReviewsExhausted(true);
      } else {
        setExtraReviews((prev) => uniqueById([...prev, ...next]));
        setReviewsPage(nextPage);
        if (res.seller.hasMoreReviews === false) setReviewsExhausted(true);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingReviews(false);
    }
  };

  // The profile brings the first 24 listings; the rest load as the list scrolls.
  const PAGE = 24;
  const more = useInfiniteQuery({
    queryKey: [...keys.seller(id), 'more'],
    initialPageParam: PAGE,
    queryFn: ({ pageParam }) => listings.seller(id, pageParam).then((r) => r.listings),
    getNextPageParam: (last, pages) => (last.length === PAGE ? PAGE * (pages.length + 1) : undefined),
    enabled: false,
  });
  const firstPage = query.data?.listings;
  const allListings = useMemo(() => uniqueById([...(firstPage ?? []), ...(more.data?.pages.flat() ?? [])]), [firstPage, more.data]);
  const categories = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>();
    for (const item of allListings) {
      if (!item.category_name) continue;
      const key = item.category_slug ?? item.category_id;
      if (!key) continue;
      const prev = map.get(key);
      if (prev) prev.count += 1;
      else map.set(key, { key, name: item.category_name, count: 1 });
    }
    return [...map.values()];
  }, [allListings]);

  const isFiltering = Boolean(debouncedQuery || selectedCategory);
  const filtered = useInfiniteQuery({
    queryKey: [...keys.seller(id), 'filter', debouncedQuery, selectedCategory],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      catalog.search({
        userId: id,
        q: debouncedQuery || undefined,
        category: selectedCategory || undefined,
        page: pageParam,
        limit: PAGE,
      }),
    getNextPageParam: (last) => (last.result.page < last.result.pages ? last.result.page + 1 : undefined),
    enabled: isFiltering && Boolean(id),
  });
  const filteredListings = useMemo(
    () => uniqueById(filtered.data?.pages.flatMap((p) => p.result.listings) ?? []),
    [filtered.data],
  );
  const displayedListings = isFiltering ? filteredListings : allListings;
  const hasMore = isFiltering
    ? Boolean(filtered.hasNextPage)
    : !!seller && (firstPage?.length ?? 0) === PAGE && (more.data ? more.hasNextPage : true);
  const loadMore = () => {
    if (isFiltering) {
      if (filtered.hasNextPage && !filtered.isFetchingNextPage) void filtered.fetchNextPage();
      return;
    }
    if (!hasMore || more.isFetching) return;
    void (more.data ? more.fetchNextPage() : more.refetch());
  };
  const notFound = query.error instanceof ApiError && query.error.status === 404;

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header
        title={store?.name ?? seller?.name ?? 'Satıcı'}
        right={
          seller ? (
            <IconButton
              icon={Share2}
              label="Paylaş"
              onPress={() => void Share.share({ message: `${store?.name ?? seller.name} – GeldeSat\n${webUrl(`/satici/${seller.id}`)}` })}
            />
          ) : undefined
        }
      />
      {query.isLoading ? (
        <Loading />
      ) : notFound ? (
        <EmptyState icon={UserX} title="Satıcı bulunamadı" message="Bu hesap kapatılmış ya da askıya alınmış olabilir." />
      ) : query.isError || !seller ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <ListingGrid
          bottomInset={insets.bottom}
          listings={displayedListings}
          loading={isFiltering && filtered.isLoading}
          refreshing={query.isRefetching}
          onRefresh={() => {
            setReviewsPage(1);
            setExtraReviews([]);
            setExpandedReviews(false);
            setReviewsExhausted(false);
            queryClient.removeQueries({ queryKey: [...keys.seller(id), 'more'] });
            void queryClient.invalidateQueries({ queryKey: [...keys.seller(id), 'filter'] });
            void query.refetch();
          }}
          onEndReached={loadMore}
          loadingMore={isFiltering ? filtered.isFetchingNextPage : more.isFetching}
          loadMoreError={isFiltering ? filtered.isFetchNextPageError : more.isError}
          onRetryMore={loadMore}
          header={
            <View style={styles.header}>
              {isOwner ? (
                <View style={[styles.ownerBar, { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
                  <View style={styles.row}>
                    <Eye size={18} color={c.primary} />
                    <Text variant="caption" style={styles.flex}>
                      <Text variant="caption" style={styles.bold}>
                        Bu sizin profiliniz.
                      </Text>{' '}
                      Alıcılar sayfanızı böyle görür.
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Button title="Profili düzenle" icon={Pencil} size="sm" variant="outline" onPress={() => router.push('/ayarlar/profil')} />
                  </View>
                </View>
              ) : null}
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Avatar name={store?.name ?? seller.name} uri={store?.logo ?? seller.avatar_url} size={64} />
                  <View style={styles.flex}>
                    <Text variant="heading">{store?.name ?? seller.name}</Text>
                    {store ? (
                      <View style={styles.row}>
                        <BadgeCheck size={14} color={c.primary} />
                        <Text variant="caption" tone="primary">
                          Kurumsal mağaza
                        </Text>
                        <Text variant="caption" tone="muted">
                          · {seller.name}
                        </Text>
                      </View>
                    ) : null}
                    {seller.rating_count ? (
                      <View style={styles.row}>
                        <Stars value={seller.rating_avg} size={13} />
                        <Text variant="caption" tone="muted">
                          {seller.rating_avg.toFixed(1)} · {seller.rating_count} değerlendirme
                        </Text>
                      </View>
                    ) : (
                      <Text variant="caption" tone="muted">
                        Henüz değerlendirme yok
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.facts}>
                  {store?.city || seller.city ? <Fact icon={MapPin} text={store?.city || seller.city} /> : null}
                  <Fact icon={CalendarDays} text={memberSince(seller.since)} />
                  <Fact icon={LayoutGrid} text={`${seller.listing_count} yayında ilan`} />
                  {followOn && followQuery.data ? (
                    <Fact icon={Users} text={`${formatNumber(followQuery.data.followers)} takipçi`} />
                  ) : null}
                  {responseBadge ? (
                    <View style={styles.row}>
                      <MessageCircle size={14} color={c.primary} />
                      <Badge label={responseBadge} tone="primary" />
                    </View>
                  ) : null}
                  {seller.availability?.callHours ? (
                    <Fact icon={Clock} text={`Aranabilir: ${seller.availability.callHours}`} />
                  ) : null}
                </View>
                {seller.availability?.awayMode && seller.availability.awayMessage ? (
                  <View style={[styles.awayBox, { backgroundColor: c.warnSoft, borderColor: c.warn }]}>
                    <Text variant="caption" tone="warn">
                      {seller.availability.awayMessage}
                    </Text>
                  </View>
                ) : null}
                {store?.description ? <Text>{store.description}</Text> : null}
                {seller.bio ? <Text tone="muted">{seller.bio}</Text> : null}
                {followOn && !isOwner ? (
                  <Button
                    title={followQuery.data?.following ? 'Takip ediliyor' : 'Takip et'}
                    icon={followQuery.data?.following ? UserCheck : UserPlus}
                    variant={followQuery.data?.following ? 'soft' : 'primary'}
                    size="sm"
                    loading={toggleFollow.isPending}
                    onPress={() => {
                      if (!requireAuth('Satıcıyı takip etmek için giriş yapın.')) return;
                      toggleFollow.mutate(Boolean(followQuery.data?.following));
                    }}
                  />
                ) : null}
              </Card>

              {reviews.length ? (
                <View style={styles.reviews}>
                  <Text variant="subheading">Değerlendirmeler</Text>
                  {reviews.slice(0, expandedReviews ? undefined : 5).map((r) => (
                    <Card key={r.id} style={styles.review}>
                      <View style={styles.row}>
                        <Stars value={r.rating} size={12} />
                        <Text variant="caption" tone="muted" style={styles.flex}>
                          {r.reviewer} · {formatDate(r.at)}
                        </Text>
                      </View>
                      {r.comment ? <Text variant="caption">{r.comment}</Text> : null}
                    </Card>
                  ))}
                  {(!expandedReviews && reviews.length > 5) || (!reviewsExhausted && (seller.hasMoreReviews || reviews.length < seller.rating_count)) ? (
                    <Button
                      title="Daha fazla yorum göster"
                      variant="outline"
                      size="sm"
                      loading={loadingReviews}
                      onPress={() => void loadMoreReviews()}
                    />
                  ) : null}
                </View>
              ) : null}
              <Text variant="subheading">İlanları</Text>
              {allListings.length > 0 ? (
                <View style={styles.filterBox}>
                  <Input
                    icon={Search}
                    placeholder="İlanlarında ara…"
                    value={searchQuery}
                    onChangeText={onChangeSearch}
                    right={searchQuery ? <IconButton icon={X} label="Temizle" size={32} onPress={() => onChangeSearch('')} /> : undefined}
                  />
                  {categories.length > 1 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                      <Chip label="Tümü" count={allListings.length} selected={!selectedCategory} onPress={() => setSelectedCategory(null)} />
                      {categories.map((cat) => (
                        <Chip
                          key={cat.key}
                          label={cat.name}
                          count={cat.count}
                          selected={selectedCategory === cat.key}
                          onPress={() => setSelectedCategory(selectedCategory === cat.key ? null : cat.key)}
                        />
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              ) : null}
            </View>
          }
          empty={
            isFiltering && filtered.isError && !filtered.data ? (
              <ErrorState compact error={filtered.error} onRetry={() => void filtered.refetch()} />
            ) : allListings.length > 0 && isFiltering ? (
              <EmptyState
                compact
                icon={Search}
                title="Eşleşen ilan bulunamadı"
                action={
                  <Button
                    title="Filtreyi temizle"
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      setSearchQuery('');
                      setDebouncedQuery('');
                      setSelectedCategory(null);
                    }}
                  />
                }
              />
            ) : (
              <EmptyState compact icon={LayoutGrid} title="Yayında ilanı yok" />
            )
          }
        />
      )}
    </View>
  );
}

function Fact({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <Icon size={14} color={c.subtle} />
      <Text variant="caption" tone="muted">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: space.lg, paddingVertical: space.lg, paddingHorizontal: space.xs },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  ownerBar: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  awayBox: { borderRadius: radius.md, borderWidth: 1, padding: space.sm },
  bold: { fontWeight: '700' },
  reviews: { gap: space.sm },
  review: { gap: space.xs, padding: space.md },
  filterBox: { gap: space.sm },
  chips: { gap: space.sm },
});
