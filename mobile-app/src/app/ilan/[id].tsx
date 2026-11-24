import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import {
  BadgeCheck,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  Flag,
  Hash,
  Heart,
  HandCoins,
  MapPin,
  MessageCircle,
  Navigation,
  Pencil,
  RefreshCw,
  Phone,
  Scale,
  Share2,
  ShieldCheck,
  Star,
  Store,
  TrendingDown,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { ApiError, errorMessage } from '@/api/client';
import { follows, listings, myListings } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { Listing, SellerResponseStats } from '@/api/types';
import { useSession } from '@/auth/session';
import { useRequireAuth } from '@/auth/useRequireAuth';
import { useToggleFavorite } from '@/features/listing/favorites';
import { Gallery } from '@/features/listing/Gallery';
import { ListingRail } from '@/features/listing/ListingRail';
import { MessageSheet, OfferSheet, PhoneSheet, ReportSheet, ReviewSheet } from '@/features/listing/ListingSheets';
import { toggleCompare, useCompareList } from '@/lib/compare';
import { mediaUrl, webUrl } from '@/lib/config';
import { useFlag } from '@/lib/flags';
import { daysUntil, formatDate, formatNumber, formatPrice, isListingExpired, isListingLive, listingStatusLabel, locationLabel, timeAgo } from '@/lib/format';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  Sheet,
  Skeleton,
  Stars,
  Text,
  Wordmark,
  hairline,
  radius,
  shadow,
  space,
  toast,
  useTheme,
} from '@/ui';

type SheetName = 'message' | 'offer' | 'phone' | 'report' | 'review' | 'shareCard' | null;

/** Deep links open this screen first: going back then lands on the home screen. */
function useGoBack() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, dark } = useTheme();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const session = useSession();
  const requireAuth = useRequireAuth();
  const toggleFavorite = useToggleFavorite();
  const compareOn = useFlag('ilan_karsilastirma');
  const shareCardOn = useFlag('paylasim_karti');
  const followOn = useFlag('satici_takip');
  const copyListingOn = useFlag('benzer_ilan_ver');
  const damageOn = useFlag('arac_hasar_semasi');
  const compareList = useCompareList();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [prevId, setPrevId] = useState(id);

  if (id !== prevId) {
    setPrevId(id);
    setPhone(null);
    setSheet(null);
    setExpanded(false);
  }

  const detail = useQuery({ queryKey: keys.listing(id), queryFn: () => listings.detail(id) });
  const data = detail.data;
  const listing = data?.listing;
  const sellerId = listing?.user_id ?? '';

  const followQuery = useQuery({
    queryKey: keys.followStatus(sellerId),
    queryFn: () => follows.status(sellerId),
    enabled: followOn && !!sellerId,
  });

  const toggleFollow = useMutation({
    mutationFn: (currentlyFollowing: boolean) => (currentlyFollowing ? follows.unfollow(sellerId) : follows.follow(sellerId)),
    onSuccess: (res) => {
      queryClient.setQueryData(keys.followStatus(sellerId), res);
      void queryClient.invalidateQueries({ queryKey: keys.followedSellers });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // Opening a listing puts it on the account's "Son baktıklarım" (recorded by the server).
  const listingId = listing?.id;
  useEffect(() => {
    if (listingId && session.status === 'signedIn') void queryClient.invalidateQueries({ queryKey: keys.recent });
  }, [listingId, session.status]);

  const renew = useMutation({
    mutationFn: (listingId: string) => myListings.action(listingId, { action: 'renew' }),
    onSuccess: () => {
      toast.success('İlan süresi 30 gün uzatıldı');
      void queryClient.invalidateQueries({ queryKey: keys.listing(id) });
      void queryClient.invalidateQueries({ queryKey: keys.myListings });
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const galleryHeight = Math.round(width * 0.78);

  if (detail.isError && !detail.data) {
    const notFound = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={styles.backOnly}>
          <IconButton icon={ChevronLeft} label="Geri" onPress={goBack} />
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
  // Same rule as the website and the server: an ACTIVE listing past its end date is off the air.
  const expired = isListingExpired(listing);
  const live = isListingLive(listing);
  const daysLeft = daysUntil(listing.expires_at);
  const priceDrop = data.history.length > 1 ? data.history[0].price - listing.price : 0;
  const damageSummary = damageOn ? parseVehicleDamage(listing.attrs ?? {}) : null;
  const attrs = Object.entries(listing.attrs ?? {}).filter(([k, v]) => {
    if (v === '' || v == null || k.startsWith('_')) return false;
    if (damageSummary && isDamageAttrKey(k)) return false;
    return true;
  });
  const inCompare = compareList.some((x) => x.id === listing.id);
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
    const text = `${listing.title} – ${formatPrice(listing.price, listing.currency)}`;
    // iOS adds `url` itself; Android only shares the message.
    void Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text}\n${url}` });
  };
  // Older servers do not say; then the button stays and the server answers.
  const canCall = data.hasPhone !== false;

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
                <Badge label={listingStatusLabel(listing.status ?? '', expired)} tone={live ? 'ok' : listing.status === 'REJECTED' ? 'danger' : 'warn'} />
                <Text variant="caption" tone="muted" style={styles.flex}>
                  {live && daysLeft != null ? `Bu sizin ilanınız · ${daysLeft} gün kaldı` : 'Bu sizin ilanınız'}
                </Text>
              </View>
              <View style={styles.ownerStats}>
                <OwnerStat label="Görüntülenme" value={listing.view_count ?? 0} />
                <OwnerStat label="Favori" value={data.favoriteCount} />
                <OwnerStat label="Telefon" value={data.phoneRevealCount} />
              </View>
              {expired && listing.status === 'ACTIVE' ? (
                <View style={[styles.expired, { backgroundColor: c.warnSoft }]}>
                  <Text variant="caption" tone="warn">
                    Yayın süresi {formatDate(listing.expires_at)} tarihinde doldu; ilan alıcılara görünmüyor. Yenileyerek 30 gün daha yayında tutabilirsiniz.
                  </Text>
                  <Button
                    title="Yenile ve yayına al"
                    icon={RefreshCw}
                    size="sm"
                    loading={renew.isPending}
                    onPress={() => renew.mutate(listing.id)}
                  />
                </View>
              ) : null}
              <View style={styles.ownerActions}>
                <Button
                  title="Düzenle"
                  icon={Pencil}
                  size="sm"
                  variant="soft"
                  onPress={() => router.push({ pathname: '/ilan-ver', params: { id: listing.id } })}
                />
                {copyListingOn ? (
                  <Button
                    title="Benzer ilan ver"
                    icon={Copy}
                    size="sm"
                    variant="outline"
                    onPress={() => router.push({ pathname: '/ilan-ver', params: { copyFrom: listing.id } })}
                  />
                ) : null}
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
                  {formatPrice(priceDrop, listing.currency)} düştü · ilk fiyat {formatPrice(data.history[0].price, listing.currency)}
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
                <InfoRow label={key} value={attrText(value)} />
              </View>
            ))}
          </Card>

          {damageSummary ? <VehicleDamageCard summary={damageSummary} /> : null}

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

          {data.history.length > 1 ? (
            <View style={styles.section}>
              <Text variant="subheading">Fiyat geçmişi</Text>
              <Card padded={false}>
                {data.history.map((h, i) => (
                  <View key={`${h.at}-${i}`}>
                    {i > 0 ? <Divider inset={space.lg} /> : null}
                    <InfoRow label={formatDate(h.at)} value={formatPrice(h.price, listing.currency)} />
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          <SellerCard
            listing={listing}
            rating={data.sellerStats}
            onPress={() => listing.user_id && router.push({ pathname: '/satici/[id]', params: { id: listing.user_id } })}
            follow={
              followOn && !isOwner && sellerId
                ? {
                    followers: followQuery.data?.followers,
                    following: Boolean(followQuery.data?.following),
                    busy: toggleFollow.isPending,
                    onToggle: () => {
                      if (!requireAuth('Satıcıyı takip etmek için giriş yapın.')) return;
                      toggleFollow.mutate(Boolean(followQuery.data?.following));
                    },
                  }
                : undefined
            }
          />

          {data.reviews.length ? (
            <View style={styles.section}>
              <View style={styles.row}>
                <Text variant="subheading" style={styles.flex}>
                  Satıcı yorumları
                </Text>
                {listing.user_id && data.sellerStats.rating_count > 3 ? (
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={8}
                    onPress={() => router.push({ pathname: '/satici/[id]', params: { id: listing.user_id ?? '' } })}
                  >
                    <Text variant="label" tone="primary">
                      Tümünü gör ({data.sellerStats.rating_count})
                    </Text>
                  </Pressable>
                ) : null}
              </View>
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
          {compareOn || shareCardOn ? (
            <View style={styles.inlineActions}>
              {compareOn ? (
                <Button
                  title={inCompare ? 'Karşılaştırmada' : 'Karşılaştır'}
                  icon={Scale}
                  variant={inCompare ? 'soft' : 'outline'}
                  size="sm"
                  style={styles.flex}
                  onPress={() => {
                    void toggleCompare({
                      id: listing.id,
                      title: listing.title,
                      price: listing.price,
                      currency: listing.currency,
                      image: listing.images[0] ?? null,
                    }).then((res) => {
                      if (res.full) toast.info('En fazla 4 ilan karşılaştırabilirsiniz.');
                      else if (res.added) toast.success('Karşılaştırma listesine eklendi');
                      else toast.info('Karşılaştırmadan çıkarıldı');
                    });
                  }}
                />
              ) : null}
              {compareOn && compareList.length > 0 ? (
                <Button
                  title={`Listeyi gör (${compareList.length})`}
                  icon={ChevronRight}
                  variant="soft"
                  size="sm"
                  onPress={() => router.push('/karsilastir' as Href)}
                />
              ) : null}
              {shareCardOn ? (
                <Button
                  title="Paylaşım kartı"
                  icon={Share2}
                  variant="outline"
                  size="sm"
                  style={styles.flex}
                  onPress={() => setSheet('shareCard')}
                />
              ) : null}
            </View>
          ) : null}
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
        <IconButton icon={ChevronLeft} label="Geri" tone={scrolled ? 'default' : 'onImage'} onPress={goBack} />
        <Text variant="bodyStrong" numberOfLines={1} style={[styles.flex, { opacity: scrolled ? 1 : 0 }]}>
          {listing.title}
        </Text>
        <IconButton icon={Share2} label="Paylaş" tone={scrolled ? 'default' : 'onImage'} onPress={share} />
        {!isOwner ? (
          <IconButton
            icon={Heart}
            label={data.isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
            tone={data.isFavorite ? 'danger' : scrolled ? 'default' : 'onImage'}
            fill={data.isFavorite}
            onPress={() => toggleFavorite(listing)}
          />
        ) : null}
      </View>

      {!isOwner && live ? (
        <View style={[styles.actionBar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: insets.bottom + space.sm }, shadow(2)]}>
          {canCall ? <Button title="Ara" icon={Phone} variant="outline" loading={phoneBusy} onPress={revealPhone} style={styles.flex} /> : null}
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
          <ReviewSheet listingId={listing.id} sellerId={listing.user_id} existing={data.reviewEligibility.existing} visible={sheet === 'review'} onClose={() => setSheet(null)} />
        </>
      ) : null}
      <PhoneSheet
        phone={phone}
        sellerName={listing.store_name ?? listing.seller_name}
        whatsapp={data.showWhatsapp !== false}
        visible={sheet === 'phone'}
        onClose={() => setSheet(null)}
      />
      {shareCardOn ? (
        <ShareCardSheet
          listing={listing}
          visible={sheet === 'shareCard'}
          onClose={() => setSheet(null)}
          onShare={share}
        />
      ) : null}
      {/* Light icons over the photos, the theme's own when there are no photos or once the header turns solid. */}
      <StatusBar style={scrolled || !listing.images.length ? (dark ? 'light' : 'dark') : 'light'} />
    </View>
  );
}

/** Attribute values as people read them: yes/no, grouped numbers. */
function attrText(value: unknown): string {
  if (value === true || value === 'true') return 'Evet';
  if (value === false || value === 'false') return 'Hayır';
  if (Array.isArray(value)) return value.join(', ');
  return typeof value === 'number' ? formatNumber(value) : String(value);
}

function OwnerStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.ownerStat}>
      <Text variant="bodyStrong">{formatNumber(value)}</Text>
      <Text variant="small" tone="muted">
        {label}
      </Text>
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

function SellerCard({
  listing,
  rating,
  onPress,
  follow,
}: {
  listing: Listing;
  rating: { rating_avg: number; rating_count: number; responseStats?: SellerResponseStats | null };
  onPress: () => void;
  follow?: { followers?: number; following: boolean; busy: boolean; onToggle: () => void };
}) {
  const { c } = useTheme();
  const name = listing.store_name ?? listing.seller_name ?? 'Satıcı';
  const r = rating.responseStats;
  return (
    <Card>
      <Pressable onPress={onPress} style={styles.row}>
        <Avatar name={name} uri={listing.seller_avatar} size={48} />
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
          {r && r.responseRate != null && r.avgReplyMinutes != null ? (
            <View style={[styles.row, styles.responseRow]}>
              <MessageCircle size={12} color={c.muted} />
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {`Yanıt oranı %${Math.round(r.responseRate)} · Ort. ${Math.round(r.avgReplyMinutes)} dk`}
              </Text>
            </View>
          ) : null}
        </View>
        <ChevronRight size={18} color={c.subtle} />
      </Pressable>
      {listing.store_name ? (
        <View style={[styles.storeLink, { borderTopColor: c.border }]}>
          <Store size={16} color={c.primary} />
          <Text variant="caption" tone="muted" style={styles.flex} numberOfLines={1}>
            Kurumsal mağaza · {listing.seller_name ?? 'Satıcı'}
          </Text>
        </View>
      ) : null}
      {follow ? (
        <View style={[styles.followRow, { borderTopColor: c.border }]}>
          <View style={styles.row}>
            <Users size={15} color={c.muted} />
            <Text variant="caption" tone="muted">
              {follow.followers != null ? `${formatNumber(follow.followers)} takipçi` : 'Satıcıyı takip et'}
            </Text>
          </View>
          <Button
            title={follow.following ? 'Takip ediliyor' : 'Takip et'}
            icon={follow.following ? UserCheck : UserPlus}
            variant={follow.following ? 'soft' : 'outline'}
            size="sm"
            loading={follow.busy}
            onPress={follow.onToggle}
          />
        </View>
      ) : null}
    </Card>
  );
}

type VehicleDamageSummary = {
  tramer?: string;
  painted: string[];
  localPainted: string[];
  replaced: string[];
  note?: string;
};

const DAMAGE_PARTS: readonly { id: string; label: string }[] = [
  { id: 'on_tampon', label: 'Ön Tampon' },
  { id: 'kaput', label: 'Kaput' },
  { id: 'tavan', label: 'Tavan' },
  { id: 'bagaj', label: 'Bagaj' },
  { id: 'arka_tampon', label: 'Arka Tampon' },
  { id: 'sol_on_camurluk', label: 'Sol Ön Çamurluk' },
  { id: 'sol_on_kapi', label: 'Sol Ön Kapı' },
  { id: 'sol_arka_kapi', label: 'Sol Arka Kapı' },
  { id: 'sol_arka_camurluk', label: 'Sol Arka Çamurluk' },
  { id: 'sag_on_camurluk', label: 'Sağ Ön Çamurluk' },
  { id: 'sag_on_kapi', label: 'Sağ Ön Kapı' },
  { id: 'sag_arka_kapi', label: 'Sağ Arka Kapı' },
  { id: 'sag_arka_camurluk', label: 'Sağ Arka Çamurluk' },
];
const DAMAGE_PART_LABELS = new Map(DAMAGE_PARTS.map((p) => [p.id, p.label]));

const DAMAGE_KEY_MATCH = /^(_damage|boyalı parçalar|lokal boyalı parçalar|değişen parçalar|hasar durumu|hasar şeması|araç hasar|hasar|tramer|tramer kaydı|hasar kaydı|ağır hasar kayıtlı)$/i;

function isDamageAttrKey(key: string): boolean {
  return DAMAGE_KEY_MATCH.test(key.trim());
}

function splitParts(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed || /^(yok|hayır|orijinal|boyasız|değişensiz)$/i.test(trimmed)) return [];
  return trimmed
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseVehicleDamage(attrs: Record<string, string | number>): VehicleDamageSummary | null {
  let tramer: string | undefined;
  let painted: string[] = [];
  let localPainted: string[] = [];
  let replaced: string[] = [];
  let note: string | undefined;
  let found = false;

  for (const [rawKey, rawVal] of Object.entries(attrs)) {
    if (rawVal === '' || rawVal == null) continue;
    const key = rawKey.trim().toLocaleLowerCase('tr');
    if (key === '_damage' || key === 'hasar şeması' || key === 'araç hasar' || key === 'hasar durumu' || key === 'hasar') {
      const text = String(rawVal).trim();
      if (text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text) as {
            p?: string;
            t?: number;
            tramer?: string | number;
            painted?: string[];
            localPainted?: string[];
            replaced?: string[];
            parts?: Record<string, string>;
          };
          if (typeof parsed.p === 'string') {
            DAMAGE_PARTS.forEach((part, idx) => {
              const code = parsed.p?.charAt(idx);
              if (code === '1') localPainted.push(part.label);
              else if (code === '2') painted.push(part.label);
              else if (code === '3') replaced.push(part.label);
            });
            found = true;
          } else if (parsed.parts && typeof parsed.parts === 'object') {
            for (const [partId, status] of Object.entries(parsed.parts)) {
              const label = DAMAGE_PART_LABELS.get(partId) ?? partId;
              if (status === 'boyali' || status === 'painted' || status === 'Boyalı') painted.push(label);
              else if (status === 'lokal' || status === 'local' || status === 'Lokal Boyalı') localPainted.push(label);
              else if (status === 'degisen' || status === 'replaced' || status === 'Değişen') replaced.push(label);
            }
            found = true;
          }
          const rawTramer = parsed.t !== undefined ? parsed.t : parsed.tramer;
          if (rawTramer != null && rawTramer !== '') {
            tramer = typeof rawTramer === 'number' ? (rawTramer === 0 ? '0 ₺ (Yok)' : formatPrice(rawTramer, 'TRY')) : String(rawTramer);
            found = true;
          }
          if (Array.isArray(parsed.painted)) {
            painted = parsed.painted;
            found = true;
          }
          if (Array.isArray(parsed.localPainted)) {
            localPainted = parsed.localPainted;
            found = true;
          }
          if (Array.isArray(parsed.replaced)) {
            replaced = parsed.replaced;
            found = true;
          }
        } catch {
          found = true;
          note = text;
        }
      } else {
        found = true;
        note = text;
      }
    } else if (key === 'tramer' || key === 'tramer kaydı' || key === 'hasar kaydı') {
      found = true;
      tramer = typeof rawVal === 'number' ? formatPrice(rawVal, 'TRY') : String(rawVal);
    } else if (key === 'boyalı parçalar') {
      found = true;
      painted = splitParts(rawVal);
    } else if (key === 'lokal boyalı parçalar') {
      found = true;
      localPainted = splitParts(rawVal);
    } else if (key === 'değişen parçalar') {
      found = true;
      replaced = splitParts(rawVal);
    } else if (key === 'ağır hasar kayıtlı') {
      found = true;
      if (rawVal === 'Evet' || rawVal === 'true') note = 'Ağır hasar kayıtlı';
    }
  }

  if (!found) return null;
  return { tramer, painted, localPainted, replaced, note };
}

function VehicleDamageCard({ summary }: { summary: VehicleDamageSummary }) {
  const { c } = useTheme();
  const cleanAll = summary.painted.length === 0 && summary.localPainted.length === 0 && summary.replaced.length === 0;
  return (
    <Card style={styles.damageCard}>
      <View style={styles.row}>
        <CarFront size={18} color={c.primary} />
        <Text variant="subheading" style={styles.flex}>
          Hasar & Tramer Özeti
        </Text>
        {cleanAll ? <Badge label="Boyasız / Değişensiz" tone="ok" /> : null}
      </View>
      {summary.tramer ? (
        <View style={[styles.tramerRow, { backgroundColor: c.elevated }]}>
          <Text variant="caption" tone="muted">
            Tramer Kaydı
          </Text>
          <Text variant="label">{summary.tramer}</Text>
        </View>
      ) : null}
      {summary.note ? (
        <Text variant="caption" tone="warn">
          {summary.note}
        </Text>
      ) : null}
      {summary.replaced.length > 0 ? (
        <DamageGroup label="Değişen" items={summary.replaced} tone="danger" />
      ) : null}
      {summary.painted.length > 0 ? (
        <DamageGroup label="Boyalı" items={summary.painted} tone="warn" />
      ) : null}
      {summary.localPainted.length > 0 ? (
        <DamageGroup label="Lokal Boyalı" items={summary.localPainted} tone="primary" />
      ) : null}
    </Card>
  );
}

function DamageGroup({ label, items, tone }: { label: string; items: string[]; tone: 'danger' | 'warn' | 'primary' }) {
  return (
    <View style={styles.damageGroup}>
      <Text variant="caption" tone="muted">
        {label} ({items.length})
      </Text>
      <View style={styles.damageBadges}>
        {items.map((part) => (
          <Badge key={part} label={part} tone={tone} />
        ))}
      </View>
    </View>
  );
}

function ShareCardSheet({
  listing,
  visible,
  onClose,
  onShare,
}: {
  listing: Listing;
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
}) {
  const { c } = useTheme();
  const cover = mediaUrl(listing.images[0], 800);
  const loc = locationLabel(listing.city, listing.district, listing.neighborhood);
  return (
    <Sheet visible={visible} onClose={onClose} title="Paylaşım kartı">
      <Card padded={false} style={[styles.shareCard, { borderColor: c.primary }]}>
        <View style={[styles.shareHeader, { backgroundColor: c.primarySoft }]}>
          <Wordmark size={20} />
          {listing.listing_no ? <Badge label={`#${listing.listing_no}`} tone="primary" /> : null}
        </View>
        {cover ? <Image source={cover} style={styles.shareImage} contentFit="cover" /> : null}
        <View style={styles.shareBody}>
          <Text variant="display" tone="primary">
            {formatPrice(listing.price, listing.currency)}
          </Text>
          <Text variant="subheading" numberOfLines={2}>
            {listing.title}
          </Text>
          {loc ? (
            <View style={styles.metaRow}>
              <MapPin size={14} color={c.muted} />
              <Text variant="caption" tone="muted">
                {loc}
              </Text>
            </View>
          ) : null}
          <Text variant="small" tone="subtle" numberOfLines={1}>
            {webUrl(`/ilan/${listing.slug}`)}
          </Text>
        </View>
      </Card>
      <Button title="Paylaş" icon={Share2} block haptic onPress={onShare} />
    </Sheet>
  );
}

function DetailSkeleton({ height }: { height: number }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack();
  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Skeleton height={height} rounded={0} />
      <View style={[styles.topBar, { paddingTop: insets.top + space.xs }]}>
        <IconButton icon={ChevronLeft} label="Geri" tone="onImage" onPress={goBack} />
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
  expired: { borderRadius: radius.md, padding: space.md, gap: space.sm },
  flex: { flex: 1 },
  grow: { flex: 1.4 },
  shrink: { flexShrink: 1 },
  backOnly: { padding: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  body: { padding: space.lg, gap: space.lg },
  ownerCard: { gap: space.md, borderWidth: 1 },
  ownerStats: { flexDirection: 'row', gap: space.sm },
  ownerStat: { flex: 1, alignItems: 'center', gap: 2 },
  ownerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
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
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  responseRow: { marginTop: 2 },
  storeLink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: hairline },
  followRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: hairline },
  damageCard: { gap: space.md },
  tramerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.md, borderRadius: radius.md },
  damageGroup: { gap: space.xs },
  damageBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  shareCard: { overflow: 'hidden', borderWidth: 1 },
  shareHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md },
  shareImage: { width: '100%', aspectRatio: 16 / 9 },
  shareBody: { padding: space.lg, gap: space.xs },
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
