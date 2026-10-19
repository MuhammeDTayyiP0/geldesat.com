import { Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, LayoutGrid, MapPin, Share2, Store, UserRound } from 'lucide-react-native';
import { listings } from '@/api/endpoints';
import { keys } from '@/api/queries';
import { ListingGrid } from '@/features/listing/ListingGrid';
import { webUrl } from '@/lib/config';
import { Badge, Button, Card, EmptyState, ErrorState, Header, IconButton, Loading, Text, radius, space, useTheme } from '@/ui';

export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const router = useRouter();
  const query = useQuery({ queryKey: keys.store(slug), queryFn: () => listings.store(slug) });
  const store = query.data?.store;

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header
        title={store?.name ?? 'Mağaza'}
        right={
          store ? (
            <IconButton icon={Share2} label="Paylaş" onPress={() => void Share.share({ message: `${store.name} – GeldeSat\n${webUrl(`/magaza/${store.slug}`)}` })} />
          ) : undefined
        }
      />
      {query.isLoading ? (
        <Loading />
      ) : query.isError || !store ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <ListingGrid
          listings={query.data?.listings ?? []}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          header={
            <View style={styles.header}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View style={[styles.logo, { backgroundColor: c.primarySoft }]}>
                    <Store size={28} color={c.primary} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.row}>
                      <Text variant="heading" style={styles.shrink} numberOfLines={2}>
                        {store.name}
                      </Text>
                      <BadgeCheck size={18} color={c.primary} />
                    </View>
                    <Badge label={store.plan} tone="primary" />
                  </View>
                </View>
                {store.city ? (
                  <View style={styles.row}>
                    <MapPin size={14} color={c.subtle} />
                    <Text variant="caption" tone="muted">
                      {store.city}
                    </Text>
                  </View>
                ) : null}
                {store.description ? <Text tone="muted">{store.description}</Text> : null}
                <Button
                  title="Satıcı profili"
                  icon={UserRound}
                  variant="outline"
                  size="sm"
                  onPress={() => router.push({ pathname: '/satici/[id]', params: { id: store.user_id } })}
                />
              </Card>
              <Text variant="subheading">Mağaza ilanları</Text>
            </View>
          }
          empty={<EmptyState compact icon={LayoutGrid} title="Bu mağazada yayında ilan yok" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  header: { gap: space.lg, paddingVertical: space.lg, paddingHorizontal: space.xs },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logo: { width: 60, height: 60, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
});
