import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Store, UserCheck, UserMinus } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { follows } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { FollowedSellerSummary } from '@/api/types';
import { useSession } from '@/auth/session';
import { useFlag } from '@/lib/flags';
import { formatDate } from '@/lib/format';
import { Avatar, Badge, Button, Divider, EmptyState, ErrorState, Header, IconButton, Loading, Text, space, toast, useTheme } from '@/ui';

const ListSeparator = () => <Divider inset={76} />;

export default function FollowedSellersScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const followOn = useFlag('satici_takip');

  const query = useQuery({
    queryKey: keys.followedSellers,
    queryFn: follows.mine,
    enabled: followOn && session.status === 'signedIn',
  });
  const rows = query.data ?? [];

  const unfollow = useMutation({
    mutationFn: (sellerId: string) => follows.unfollow(sellerId),
    onMutate: async (sellerId) => {
      await queryClient.cancelQueries({ queryKey: keys.followedSellers });
      const before = queryClient.getQueryData<FollowedSellerSummary[]>(keys.followedSellers);
      queryClient.setQueryData<FollowedSellerSummary[]>(keys.followedSellers, (list) =>
        list?.filter((x) => x.id !== sellerId),
      );
      return { before };
    },
    onSuccess: (res, sellerId) => {
      queryClient.setQueryData(keys.followStatus(sellerId), res);
      toast.success('Satıcı takipten çıkarıldı');
    },
    onError: (e, _, ctx) => {
      queryClient.setQueryData(keys.followedSellers, ctx?.before);
      toast.error(errorMessage(e));
    },
  });

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header title="Takip ettiklerim" subtitle={followOn && rows.length ? `${rows.length} satıcı` : undefined} />

      {!followOn ? (
        <EmptyState icon={UserCheck} title="Satıcı takibi kapalı" message="Bu özellik şu anda kullanıma kapalı." />
      ) : session.status !== 'signedIn' ? (
        <EmptyState icon={UserCheck} title="Giriş yapın" action={<Button title="Giriş yap" onPress={() => router.push('/giris')} />} />
      ) : query.isLoading && !query.data ? (
        <Loading />
      ) : query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="Takip ettiğiniz satıcı yok"
          message="Beğendiğiniz satıcıların ilan veya profil sayfasından “Takip et” butonuna basabilirsiniz."
          action={<Button title="İlanlara göz at" onPress={() => router.push('/(tabs)/ara')} />}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={ListSeparator}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.primary} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/satici/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.elevated }]}
            >
              <Avatar name={item.name} uri={item.avatar} size={48} />
              <View style={styles.body}>
                <View style={styles.nameRow}>
                  <Text variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
                    {item.name}
                  </Text>
                  {item.store_name ? (
                    <Badge label={item.store_name} tone="primary" />
                  ) : null}
                </View>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {item.active_count} yayında ilan · {formatDate(item.followed_at)}
                </Text>
              </View>
              {item.store_name ? <Store size={14} color={c.primary} /> : null}
              <IconButton
                icon={UserMinus}
                label="Takibi bırak"
                onPress={() => unfollow.mutate(item.id)}
              />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  body: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
