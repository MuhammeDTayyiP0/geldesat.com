import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { History, ImageOff, Trash2, X } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { listings } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { RecentListing } from '@/api/types';
import { useSession } from '@/auth/session';
import { mediaUrl } from '@/lib/config';
import { formatPrice, isListingExpired, listingStatusLabel, timeAgo } from '@/lib/format';
import { Badge, Button, Divider, EmptyState, ErrorState, Header, IconButton, Loading, Text, confirm, radius, space, toast, useTheme } from '@/ui';

/** The account's last 50 viewed listings (same list as the website); each can be removed, or all cleared. */
export default function RecentScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const session = useSession();
  const query = useQuery({ queryKey: keys.recent, queryFn: listings.recent, enabled: session.status === 'signedIn' });
  const rows = query.data ?? [];

  const remove = useMutation({
    mutationFn: (listingId: string | null) => listings.removeRecent(listingId),
    onMutate: (listingId) => {
      const before = queryClient.getQueryData<RecentListing[]>(keys.recent);
      queryClient.setQueryData<RecentListing[]>(keys.recent, (d) => (listingId ? d?.filter((x) => x.id !== listingId) : []));
      return { before };
    },
    onSuccess: (_, listingId) => {
      if (!listingId) toast.success('Geçmiş temizlendi');
    },
    onError: (e, _, ctx) => {
      queryClient.setQueryData(keys.recent, ctx?.before);
      toast.error(errorMessage(e));
    },
  });

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Geçmiş temizlensin mi?',
      message: 'Son baktığınız ilanların listesi silinir.',
      confirmText: 'Temizle',
      destructive: true,
    });
    if (ok) remove.mutate(null);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header
        title="Son baktıklarım"
        subtitle={rows.length ? `${rows.length} ilan` : undefined}
        right={rows.length ? <IconButton icon={Trash2} label="Tümünü temizle" onPress={clearAll} /> : undefined}
      />
      {session.status !== 'signedIn' ? (
        <EmptyState icon={History} title="Giriş yapın" action={<Button title="Giriş yap" onPress={() => router.push('/giris')} />} />
      ) : query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.primary} />}
          ItemSeparatorComponent={() => <Divider inset={space.lg + 84 + space.md} />}
          contentContainerStyle={rows.length ? styles.list : styles.flexGrow}
          ListHeaderComponent={
            rows.length ? (
              <Text variant="small" tone="subtle" style={styles.note}>
                Hesabınızda son baktığınız 50 ilan saklanır.
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon={History}
              title="Henüz baktığınız ilan yok"
              message="İncelediğiniz ilanlar hesabınıza kaydedilir; buradan tekrar açabilir veya silebilirsiniz."
              action={<Button title="İlanlara göz at" variant="outline" onPress={() => router.navigate('/')} />}
            />
          }
          renderItem={({ item }) => <RecentRow item={item} onOpen={() => router.push({ pathname: '/ilan/[id]', params: { id: item.id } })} onRemove={() => remove.mutate(item.id)} />}
        />
      )}
    </View>
  );
}

function RecentRow({ item, onOpen, onRemove }: { item: RecentListing; onOpen: () => void; onRemove: () => void }) {
  const { c } = useTheme();
  const cover = mediaUrl(item.images[0], 240);
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.elevated : c.surface, opacity: item.live ? 1 : 0.7 }]}
    >
      <View style={[styles.thumb, { backgroundColor: c.elevated }]}>
        {cover ? (
          <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={item.id} />
        ) : (
          <ImageOff size={20} color={c.subtle} />
        )}
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" tone="primary" numberOfLines={1}>
          {formatPrice(item.price, item.currency)}
        </Text>
        <Text variant="caption" numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.meta}>
          {!item.live ? <Badge label={listingStatusLabel(item.status ?? '', isListingExpired(item))} tone="warn" /> : null}
          <Text variant="small" tone="subtle" numberOfLines={1} style={styles.flex}>
            {timeAgo(item.viewed_at)} baktınız
          </Text>
        </View>
      </View>
      <IconButton icon={X} label="Geçmişten kaldır" onPress={onRemove} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  list: { paddingBottom: space.xxl },
  note: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg, paddingRight: space.xs, paddingVertical: space.md },
  thumb: { width: 84, height: 72, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
});
