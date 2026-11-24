import { FlatList, Pressable, RefreshControl, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell, BellOff, Bookmark, ChevronRight, Trash2 } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { savedSearches } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { SavedSearch } from '@/api/types';
import { useSession } from '@/auth/session';
import { POSTED_WITHIN_OPTIONS, SELLER_TYPE_OPTIONS } from '@/features/search/filters';
import { formatPrice, timeAgo } from '@/lib/format';
import { Button, Card, Divider, EmptyState, ErrorState, Header, IconButton, Loading, Text, confirm, space, toast, useTheme } from '@/ui';

function summarizeSearch(item: SavedSearch): string {
  const parts: string[] = [];
  if (item.q) parts.push(`“${item.q}”`);
  if (item.category_slug) parts.push(item.category_slug);
  const f = item.filters ?? {};
  const loc = [typeof f.neighborhood === 'string' ? f.neighborhood : null, item.district, item.city].filter(Boolean).join(', ');
  if (loc) parts.push(loc);
  if (item.min_price != null && item.max_price != null) {
    parts.push(`${formatPrice(item.min_price)} – ${formatPrice(item.max_price)}`);
  } else if (item.min_price != null) {
    parts.push(`${formatPrice(item.min_price)} üzeri`);
  } else if (item.max_price != null) {
    parts.push(`${formatPrice(item.max_price)} altı`);
  }
  if (f.urgent === true || f.urgent === '1') parts.push('Acil');
  if (f.featured === true || f.featured === '1') parts.push('Vitrin');
  if (f.withPhotos === true || f.withPhotos === '1') parts.push('Fotoğraflı');
  if (f.priceDropped === true || f.priceDropped === '1') parts.push('Fiyatı düşen');
  if (typeof f.postedWithin === 'string') {
    const label = POSTED_WITHIN_OPTIONS.find((o) => o.value === f.postedWithin)?.label;
    if (label) parts.push(label);
  }
  if (typeof f.sellerType === 'string') {
    const label = SELLER_TYPE_OPTIONS.find((o) => o.value === f.sellerType)?.label;
    if (label) parts.push(label);
  }
  return parts.length ? parts.join(' · ') : 'Tüm ilanlar';
}

function searchParamsFor(item: SavedSearch): Record<string, string> {
  const params: Record<string, string> = {};
  if (item.q) params.q = item.q;
  if (item.category_slug) params.category = item.category_slug;
  if (item.city) params.city = item.city;
  if (item.district) params.district = item.district;
  if (item.min_price != null) params.minPrice = String(item.min_price);
  if (item.max_price != null) params.maxPrice = String(item.max_price);
  const f = item.filters ?? {};
  if (typeof f.neighborhood === 'string' && f.neighborhood) params.neighborhood = f.neighborhood;
  if (f.urgent === true || f.urgent === '1') params.urgent = '1';
  if (f.featured === true || f.featured === '1') params.featured = '1';
  if (f.withPhotos === true || f.withPhotos === '1') params.withPhotos = '1';
  if (f.priceDropped === true || f.priceDropped === '1') params.priceDropped = '1';
  if (typeof f.postedWithin === 'string' && f.postedWithin) params.postedWithin = f.postedWithin;
  if (typeof f.sellerType === 'string' && f.sellerType) params.sellerType = f.sellerType;
  if (typeof f.sort === 'string' && f.sort) params.sort = f.sort;
  return params;
}

export default function SavedSearchesScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();

  const query = useQuery({
    queryKey: keys.savedSearches,
    queryFn: savedSearches.list,
    enabled: session.status === 'signedIn',
  });
  const rows = query.data ?? [];

  const toggleNotify = useMutation({
    mutationFn: ({ id, notify }: { id: string; notify: boolean }) => savedSearches.toggleNotify(id, notify),
    onMutate: async ({ id, notify }) => {
      await queryClient.cancelQueries({ queryKey: keys.savedSearches });
      const before = queryClient.getQueryData<SavedSearch[]>(keys.savedSearches);
      queryClient.setQueryData<SavedSearch[]>(keys.savedSearches, (list) =>
        list?.map((x) => (x.id === id ? { ...x, notify } : x)),
      );
      return { before };
    },
    onError: (e, _, ctx) => {
      queryClient.setQueryData(keys.savedSearches, ctx?.before);
      toast.error(errorMessage(e));
    },
  });

  const removeSearch = useMutation({
    mutationFn: (id: string) => savedSearches.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: keys.savedSearches });
      const before = queryClient.getQueryData<SavedSearch[]>(keys.savedSearches);
      queryClient.setQueryData<SavedSearch[]>(keys.savedSearches, (list) => list?.filter((x) => x.id !== id));
      return { before };
    },
    onSuccess: () => toast.success('Kayıtlı arama silindi'),
    onError: (e, _, ctx) => {
      queryClient.setQueryData(keys.savedSearches, ctx?.before);
      toast.error(errorMessage(e));
    },
  });

  const onDelete = async (item: SavedSearch) => {
    const ok = await confirm({
      title: 'Kayıtlı arama silinsin mi?',
      message: `“${item.name}” silinecek.`,
      confirmText: 'Sil',
      destructive: true,
    });
    if (ok) removeSearch.mutate(item.id);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header title="Kayıtlı aramalarım" subtitle={rows.length ? `${rows.length} arama` : undefined} />

      {session.status !== 'signedIn' ? (
        <EmptyState icon={Bookmark} title="Giriş yapın" action={<Button title="Giriş yap" onPress={() => router.push('/giris')} />} />
      ) : query.isLoading ? (
        <Loading />
      ) : query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.primary} />}
          contentContainerStyle={rows.length ? [styles.list, { paddingBottom: insets.bottom + space.xxl }] : styles.flexGrow}
          ListEmptyComponent={
            <EmptyState
              icon={Bookmark}
              title="Kayıtlı aramanız yok"
              message="Arama sonuçlarında beğendiğiniz filtreleri kaydedin; yeni ilan eklendiğinde bildirim alın."
              action={<Button title="İlanlara göz at" variant="outline" onPress={() => router.push('/sonuclar')} />}
            />
          }
          renderItem={({ item }) => (
            <SavedSearchCard
              item={item}
              onOpen={() => router.push({ pathname: '/sonuclar', params: searchParamsFor(item) })}
              onToggleNotify={(notify) => toggleNotify.mutate({ id: item.id, notify })}
              onDelete={() => void onDelete(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function SavedSearchCard({
  item,
  onOpen,
  onToggleNotify,
  onDelete,
}: {
  item: SavedSearch;
  onOpen: () => void;
  onToggleNotify: (notify: boolean) => void;
  onDelete: () => void;
}) {
  const { c } = useTheme();
  return (
    <Card padded={false} style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, sonuçları aç`}
        onPress={onOpen}
        style={({ pressed }) => [styles.cardTop, pressed && { backgroundColor: c.elevated }]}
      >
        <View style={styles.cardInfo}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {summarizeSearch(item)}
          </Text>
          <Text variant="small" tone="subtle">
            {timeAgo(item.created_at)}
          </Text>
        </View>
        <ChevronRight size={18} color={c.subtle} />
      </Pressable>
      <Divider />
      <View style={styles.cardActions}>
        <View style={styles.notifyRow}>
          {item.notify ? <Bell size={16} color={c.primary} /> : <BellOff size={16} color={c.subtle} />}
          <Text variant="caption" tone={item.notify ? 'default' : 'muted'} style={styles.flex}>
            Yeni ilan bildirimi
          </Text>
          <Switch
            value={item.notify}
            onValueChange={onToggleNotify}
            trackColor={{ true: c.primary, false: c.border }}
            thumbColor="#ffffff"
            accessibilityLabel={`${item.name} için yeni ilan bildirimi`}
          />
        </View>
        <IconButton icon={Trash2} label={`${item.name} sil`} tone="danger" size={36} onPress={onDelete} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  list: { padding: space.lg, gap: space.md },
  card: { overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  cardInfo: { flex: 1, gap: 3 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.lg, paddingRight: space.sm, paddingVertical: space.xs },
  notifyRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
