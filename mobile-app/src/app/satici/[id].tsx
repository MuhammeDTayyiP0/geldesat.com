import { Pressable, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CalendarDays, LayoutGrid, MapPin, Share2, Store } from 'lucide-react-native';
import { listings } from '@/api/endpoints';
import { keys } from '@/api/queries';
import { ListingGrid } from '@/features/listing/ListingGrid';
import { webUrl } from '@/lib/config';
import { formatDate, memberSince } from '@/lib/format';
import { Avatar, Card, EmptyState, ErrorState, Header, IconButton, Loading, Stars, Text, space, useTheme } from '@/ui';

export default function SellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const router = useRouter();
  const query = useQuery({ queryKey: keys.seller(id), queryFn: () => listings.seller(id) });
  const seller = query.data?.seller;

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header
        title={seller?.name ?? 'Satıcı'}
        right={
          seller ? (
            <IconButton
              icon={Share2}
              label="Paylaş"
              onPress={() => void Share.share({ message: `${seller.name} – GeldeSat\n${webUrl(`/satici/${seller.id}`)}` })}
            />
          ) : undefined
        }
      />
      {query.isLoading ? (
        <Loading />
      ) : query.isError || !seller ? (
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
                  <Avatar name={seller.name} size={64} />
                  <View style={styles.flex}>
                    <Text variant="heading">{seller.name}</Text>
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
                  {seller.city ? <Fact icon={MapPin} text={seller.city} /> : null}
                  <Fact icon={CalendarDays} text={memberSince(seller.since)} />
                  <Fact icon={LayoutGrid} text={`${seller.listing_count} yayında ilan`} />
                </View>
                {seller.bio ? <Text tone="muted">{seller.bio}</Text> : null}
                {seller.store ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/magaza/[slug]', params: { slug: seller.store?.slug ?? '' } })}
                    style={[styles.store, { backgroundColor: c.primarySoft }]}
                  >
                    <Store size={18} color={c.primary} />
                    <Text variant="label" tone="primary" style={styles.flex}>
                      {seller.store.name}
                    </Text>
                    <BadgeCheck size={16} color={c.primary} />
                  </Pressable>
                ) : null}
              </Card>

              {seller.reviews.length ? (
                <View style={styles.reviews}>
                  <Text variant="subheading">Değerlendirmeler</Text>
                  {seller.reviews.slice(0, 5).map((r) => (
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
                </View>
              ) : null}
              <Text variant="subheading">İlanları</Text>
            </View>
          }
          empty={<EmptyState compact icon={LayoutGrid} title="Yayında ilanı yok" />}
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
  store: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: 10 },
  reviews: { gap: space.sm },
  review: { gap: space.xs, padding: space.md },
});
