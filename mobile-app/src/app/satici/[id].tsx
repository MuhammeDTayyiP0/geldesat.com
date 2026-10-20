import { Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CalendarDays, Eye, LayoutGrid, MapPin, Pencil, Share2, Store } from 'lucide-react-native';
import { listings } from '@/api/endpoints';
import { keys } from '@/api/queries';
import { useSession } from '@/auth/session';
import { ListingGrid } from '@/features/listing/ListingGrid';
import { webUrl } from '@/lib/config';
import { formatDate, memberSince } from '@/lib/format';
import { Avatar, Button, Card, EmptyState, ErrorState, Header, IconButton, Loading, Stars, Text, radius, space, useTheme } from '@/ui';

export default function SellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const router = useRouter();
  const query = useQuery({ queryKey: keys.seller(id), queryFn: () => listings.seller(id) });
  const seller = query.data?.seller;
  const session = useSession();
  const isOwner = session.status === 'signedIn' && session.user.id === id;
  const store = seller?.store;

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
      ) : query.isError || !seller ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <ListingGrid
          listings={query.data?.listings ?? []}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
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
                    {store ? (
                      <Button title="Mağaza" icon={Store} size="sm" variant="outline" onPress={() => router.push('/ayarlar/magaza')} />
                    ) : null}
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
                </View>
                {store?.description ? <Text>{store.description}</Text> : null}
                {seller.bio ? <Text tone="muted">{seller.bio}</Text> : null}
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
  ownerBar: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  bold: { fontWeight: '700' },
  reviews: { gap: space.sm },
  review: { gap: space.xs, padding: space.md },
});
