import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  Hash,
  Heart,
  HandCoins,
  MapPin,
  MessageCircle,
  Navigation,
  Pencil,
  Phone,
  Share2,
  ShieldCheck,
  Star,
  Store,
  TrendingDown,
} from 'lucide-react-native';
import { ApiError, errorMessage } from '@/api/client';
import { listings } from '@/api/endpoints';
import { keys } from '@/api/queries';
import type { Listing } from '@/api/types';
import { useSession } from '@/auth/session';
import { useRequireAuth } from '@/auth/useRequireAuth';
import { useToggleFavorite } from '@/features/listing/favorites';
import { Gallery } from '@/features/listing/Gallery';
import { ListingRail } from '@/features/listing/ListingRail';
import { MessageSheet, OfferSheet, PhoneSheet, ReportSheet, ReviewSheet } from '@/features/listing/ListingSheets';
import { webUrl } from '@/lib/config';
import { formatDate, formatNumber, formatPrice, listingStatusLabel, locationLabel, timeAgo } from '@/lib/format';
import { rememberListing } from '@/lib/storage';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  Skeleton,
  Stars,
  Text,
  hairline,
  radius,
  shadow,
  space,
  toast,
  useTheme,
} from '@/ui';

type SheetName = 'message' | 'offer' | 'phone' | 'report' | 'review' | null;

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const session = useSession();
  const requireAuth = useRequireAuth();
  const toggleFavorite = useToggleFavorite();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const detail = useQuery({ queryKey: keys.listing(id), queryFn: () => listings.detail(id) });
  const data = detail.data;
  const listing = data?.listing;

  useEffect(() => {
    if (listing && listing.status === 'ACTIVE') void rememberListing(listing);
  }, [listing]);

  const galleryHeight = Math.round(width * 0.78);

  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={styles.backOnly}>
          <IconButton icon={ChevronLeft} label="Geri" onPress={() => router.back()} />
        </View>
        {notFound ? (
          <EmptyState icon={Eye} title="İlan yayında değil" message="Bu ilan kaldırılmış, satılmış veya süresi dolmuş olabilir." />
        ) : (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        )}
      </View>
    );
  }

  if (!data || !listing) return <DetailSkeleton height={galleryHeight} />;

  const isOwner = data.isOwner;
  const live = listing.status === 'ACTIVE';
  const priceDrop = data.history.length > 1 ? data.history[0].price - listing.price : 0;
  const attrs = Object.entries(listing.attrs ?? {}).filter(([, v]) => v !== '' && v != null);
  const description = listing.description ?? '';
  const longDescription = description.length > 320;

  const revealPhone = async () => {
    if (phone) {
      setSheet('phone');
      return;
    }
    setPhoneBusy(true);
    try {
      setPhone(await listings.revealPhone(listing.id));
      setSheet('phone');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) requireAuth('Telefon numarasını görmek için giriş yapın.');
      else toast.error(errorMessage(e));
    } finally {
      setPhoneBusy(false);
    }
  };

  const share = () => {
    const url = webUrl(`/ilan/${listing.slug}`);
    void Share.share({ message: `${listing.title} – ${formatPrice(listing.price, listing.currency)}\n${url}`, url });
  };

  const openMap = () => {
    const q = listing.lat != null && listing.lng != null ? `${listing.lat},${listing.lng}` : locationLabel(listing.city, listing.district, listing.neighborhood);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        scrollEventThrottle={32}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > galleryHeight - 80)}
      >
        <Gallery images={listing.images} height={galleryHeight} />

        <View style={styles.body}>
          {isOwner ? (
            <Card style={[styles.ownerCard, { borderColor: c.primary }]}>
              <View style={styles.row}>
                <Badge label={listingStatusLabel(listing.status ?? '')} tone={live ? 'ok' : listing.status === 'REJECTED' ? 'danger' : 'warn'} />
                <Text variant="caption" tone="muted" style={styles.flex}>
                  Bu sizin ilanınız
                </Text>
              </View>
              <View style={styles.row}>
                <Button
                  title="Düzenle"
                  icon={Pencil}
                  size="sm"
                  variant="soft"
                  onPress={() => router.push({ pathname: '/ilan-ver', params: { id: listing.id } })}
                />
                <Button title="İlanlarım" size="sm" variant="outline" onPress={() => router.push('/ilanlarim')} />
              </View>
            </Card>
          ) : null}

          <View style={styles.titleBlock}>
            <View style={styles.row}>
              <Text variant="display" tone="primary" style={styles.flex}>
                {formatPrice(listing.price, listing.currency)}
              </Text>
              {listing.boosts?.includes('ACIL') ? <Badge label="ACİL" tone="urgent" /> : null}
            </View>
            {priceDrop > 0 ? (
              <View style={[styles.drop, { backgroundColor: c.okSoft }]}>
                <TrendingDown size={14} color={c.ok} />
                <Text variant="caption" tone="ok">
                  {formatPrice(priceDrop)} düştü · ilk fiyat {formatPrice(data.history[0].price)}
                </Text>
              </View>
            ) : null}
            <Text variant="heading">{listing.title}</Text>
            <Pressable onPress={openMap} style={styles.metaRow} accessibilityRole="link">
              <MapPin size={15} color={c.muted} />
              <Text tone="muted" style={styles.flex}>
                {locationLabel(listing.city, listing.district, listing.neighborhood)}
              </Text>
            </Pressable>
            <View style={styles.stats}>
              <Meta icon={Clock} text={timeAgo(listing.created_at)} />
              {listing.view_count ? <Meta icon={Eye} text={`${formatNumber(listing.view_count)} görüntülenme`} /> : null}
              {data.favoriteCount ? <Meta icon={Heart} text={`${formatNumber(data.favoriteCount)} favori`} /> : null}
            </View>
          </View>

          <Card padded={false}>
            <InfoRow label="İlan No" value={String(listing.listing_no ?? '—')} icon={Hash} />
            <Divider inset={space.lg} />
            <InfoRow label="İlan tarihi" value={formatDate(listing.created_at)} />
            <Divider inset={space.lg} />
            <InfoRow
              label="Kategori"
              value={listing.category_name ?? '—'}
              onPress={listing.category_slug ? () => router.push({ pathname: '/sonuclar', params: { category: listing.category_slug ?? '', title: listing.category_name ?? '' } }) : undefined}
            />
            {attrs.map(([key, value]) => (
              <View key={key}>
                <Divider inset={space.lg} />
                <InfoRow label={key} value={typeof value === 'number' ? formatNumber(value) : String(value)} />
              </View>
            ))}
          </Card>

          {description ? (
            <View style={styles.section}>
              <Text variant="subheading">Açıklama</Text>
              <Text selectable numberOfLines={expanded || !longDescription ? undefined : 8} style={styles.description}>
                {description}
              </Text>
              {longDescription ? (
                <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
                  <Text variant="label" tone="primary">
                    {expanded ? 'Daha az göster' : 'Devamını oku'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <SellerCard listing={listing} rating={data.sellerStats} onPress={() => listing.user_id && router.push({ pathname: '/satici/[id]', params: { id: listing.user_id } })} />

          {data.reviews.length ? (
            <View style={styles.section}>
              <Text variant="subheading">Satıcı yorumları</Text>
              {data.reviews.slice(0, 3).map((r) => (
                <Card key={r.id} style={styles.review}>
                  <View style={styles.row}>
                    <Stars value={r.rating} size={13} />
                    <Text variant="caption" tone="muted" style={styles.flex}>
                      {r.reviewer} · {formatDate(r.at)}
                    </Text>
                  </View>
                  {r.comment ? <Text variant="caption">{r.comment}</Text> : null}
                </Card>
              ))}
            </View>
          ) : null}

          {!isOwner && data.reviewEligibility.eligible ? (
            <Button
              title={data.reviewEligibility.existing ? 'Değerlendirmenizi güncelleyin' : 'Satıcıyı değerlendirin'}
              icon={Star}
              variant="outline"
              onPress={() => setSheet('review')}
            />
          ) : null}

          <Card style={[styles.safety, { backgroundColor: c.primarySoft, borderColor: c.primarySoft }]}>
            <View style={styles.row}>
              <ShieldCheck size={18} color={c.primary} />
              <Text variant="label" tone="primary">
                Güvenli alışveriş için
              </Text>
            </View>
            <Text variant="caption" tone="muted">
              Ürünü görmeden kapora veya ön ödeme göndermeyin. Mümkünse kalabalık ve aydınlık bir yerde buluşun, yazışmaları GeldeSat üzerinde
              tutun.
            </Text>
          </Card>

          <View style={styles.inlineActions}>
            <Button title="Haritada aç" icon={Navigation} variant="outline" size="sm" onPress={openMap} style={styles.flex} />
            {!isOwner ? (
              <Button
                title="İlanı bildir"
                icon={Flag}
                variant="outline"
                size="sm"
                style={styles.flex}
                onPress={() => requireAuth('İlanı bildirmek için giriş yapın.') && setSheet('report')}
              />
            ) : null}
          </View>
        </View>

        {data.similar.length ? (
          <View style={styles.similar}>
            <ListingRail title="Benzer ilanlar" items={data.similar} />
          </View>
        ) : null}
      </ScrollView>

      {/* Floating header over the photos; turns solid once the photos scroll away. */}
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + space.xs },
          scrolled && [{ backgroundColor: c.surface, borderBottomColor: c.border, borderBottomWidth: hairline }],
        ]}
      >
        <IconButton icon={ChevronLeft} label="Geri" tone={scrolled ? 'default' : 'onImage'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text variant="bodyStrong" numberOfLines={1} style={[styles.flex, { opacity: scrolled ? 1 : 0 }]}>
          {listing.title}
        </Text>
        <IconButton icon={Share2} label="Paylaş" tone={scrolled ? 'default' : 'onImage'} onPress={share} />
        {!isOwner ? (
          <IconButton
            icon={Heart}
            label={data.isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
            tone={data.isFavorite ? 'danger' : scrolled ? 'default' : 'onImage'}
            onPress={() => toggleFavorite(listing)}
          />
        ) : null}
      </View>

      {!isOwner && live ? (
        <View style={[styles.actionBar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: insets.bottom + space.sm }, shadow(2)]}>
          <Button title="Ara" icon={Phone} variant="outline" loading={phoneBusy} onPress={revealPhone} style={styles.flex} />
          <Button
            title="Teklif"
            icon={HandCoins}
            variant="soft"
            onPress={() => requireAuth('Teklif vermek için giriş yapın.') && setSheet('offer')}
            style={styles.flex}
          />
          <Button
            title="Mesaj"
            icon={MessageCircle}
            haptic
            onPress={() => requireAuth('Satıcıya yazmak için giriş yapın.') && setSheet('message')}
            style={styles.grow}
          />
        </View>
      ) : null}

      {session.status === 'signedIn' ? (
        <>
          <MessageSheet listing={listing} visible={sheet === 'message'} onClose={() => setSheet(null)} />
          <OfferSheet listing={listing} visible={sheet === 'offer'} onClose={() => setSheet(null)} />
          <ReportSheet listingId={listing.id} visible={sheet === 'report'} onClose={() => setSheet(null)} />
          <ReviewSheet listingId={listing.id} existing={data.reviewEligibility.existing} visible={sheet === 'review'} onClose={() => setSheet(null)} />
        </>
      ) : null}
      <PhoneSheet phone={phone} sellerName={listing.store_name ?? listing.seller_name} visible={sheet === 'phone'} onClose={() => setSheet(null)} />
    </View>
  );
}

function Meta({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.metaRow}>
      <Icon size={13} color={c.subtle} />
      <Text variant="caption" tone="subtle">
        {text}
      </Text>
    </View>
  );
}

function InfoRow({ label, value, icon: Icon, onPress }: { label: string; value: string; icon?: typeof Hash; onPress?: () => void }) {
  const { c } = useTheme();
  const content = (
    <>
      <Text tone="muted" style={styles.infoLabel}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={styles.infoValue} selectable={!onPress} tone={onPress ? 'primary' : 'default'}>
        {value}
      </Text>
      {Icon ? <Icon size={14} color={c.subtle} /> : null}
      {onPress ? <ChevronRight size={16} color={c.primary} /> : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={styles.infoRow}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.infoRow}>{content}</View>
  );
}

function SellerCard({ listing, rating, onPress }: { listing: Listing; rating: { rating_avg: number; rating_count: number }; onPress: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const name = listing.store_name ?? listing.seller_name ?? 'Satıcı';
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <Avatar name={name} size={48} />
        <View style={styles.flex}>
          <View style={styles.row}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
              {name}
            </Text>
            {listing.store_name ? <BadgeCheck size={16} color={c.primary} /> : null}
          </View>
          {rating.rating_count ? (
            <View style={styles.row}>
              <Stars value={rating.rating_avg} size={12} />
              <Text variant="caption" tone="muted">
                {rating.rating_avg.toFixed(1)} ({rating.rating_count})
              </Text>
            </View>
          ) : (
            <Text variant="caption" tone="muted">
              Henüz değerlendirme yok
            </Text>
          )}
        </View>
        <ChevronRight size={18} color={c.subtle} />
      </View>
      {listing.store_slug ? (
        <Pressable
          onPress={() => router.push({ pathname: '/magaza/[slug]', params: { slug: listing.store_slug ?? '' } })}
          style={[styles.storeLink, { borderTopColor: c.border }]}
        >
          <Store size={16} color={c.primary} />
          <Text variant="label" tone="primary">
            Mağazayı ziyaret et
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function DetailSkeleton({ height }: { height: number }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Skeleton height={height} rounded={0} />
      <View style={[styles.topBar, { paddingTop: insets.top + space.xs }]}>
        <IconButton icon={ChevronLeft} label="Geri" tone="onImage" onPress={() => router.back()} />
      </View>
      <View style={styles.body}>
        <Skeleton width="45%" height={30} />
        <Skeleton width="90%" height={20} />
        <Skeleton width="60%" height={14} />
        <Skeleton height={180} rounded={radius.lg} />
        <Skeleton height={90} rounded={radius.lg} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1.4 },
  shrink: { flexShrink: 1 },
  backOnly: { padding: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  body: { padding: space.lg, gap: space.lg },
  ownerCard: { gap: space.md, borderWidth: 1 },
  titleBlock: { gap: space.sm },
  drop: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, minHeight: 48, paddingVertical: space.sm },
  infoLabel: { flex: 1 },
  infoValue: { flex: 1.2, textAlign: 'right' },
  section: { gap: space.sm },
  description: { lineHeight: 23 },
  review: { gap: space.xs, padding: space.md },
  safety: { gap: space.sm },
  inlineActions: { flexDirection: 'row', gap: space.sm },
  storeLink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: hairline },
  similar: { paddingBottom: space.lg },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingBottom: space.xs,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: hairline,
  },
});
