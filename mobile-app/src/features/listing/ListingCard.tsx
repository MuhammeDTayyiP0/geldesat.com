import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Heart, ImageOff, MapPin } from 'lucide-react-native';
import type { Listing } from '@/api/types';
import { mediaUrl } from '@/lib/config';
import { formatNumber, formatPrice, timeAgo } from '@/lib/format';
import { Badge, Text, radius, space, useTheme } from '@/ui';

type Props = {
  listing: Pick<Listing, 'id' | 'title' | 'price' | 'currency' | 'images' | 'city' | 'district' | 'created_at' | 'attrs'> &
    Partial<Pick<Listing, 'boosts' | 'category_name' | 'featured_until'>>;
  onPress: () => void;
  favorite?: boolean;
  onFavorite?: () => void;
  layout?: 'grid' | 'row' | 'rail';
};

/** Up to two highlight attributes (year, km, m², rooms) shown under the title. */
function highlights(attrs: Record<string, string | number>): string[] {
  const out: string[] = [];
  const pick = (keys: string[], suffix = '') => {
    for (const key of keys) {
      const v = attrs[key];
      if (v !== undefined && v !== '' && out.length < 2) {
        out.push(typeof v === 'number' ? `${formatNumber(v)}${suffix}` : `${v}${suffix}`);
        return;
      }
    }
  };
  // Attribute values are keyed by attribute name, as the site stores them.
  pick(['Yıl']);
  pick(['KM'], ' km');
  pick(['m²', 'm² (Net)', 'm² (Brüt)'], ' m²');
  pick(['Oda Sayısı']);
  return out;
}

/** Showcase listing: admins feature it with featured_until (the VITRIN boost is kept for paid doping). */
function isFeatured(listing: Pick<Listing, 'boosts' | 'featured_until'>): boolean {
  if (listing.boosts?.includes('VITRIN')) return true;
  return !!listing.featured_until && new Date(listing.featured_until).getTime() > Date.now();
}

export const ListingCard = memo(function ListingCard({ listing, onPress, favorite, onFavorite, layout = 'grid' }: Props) {
  const { c } = useTheme();
  const cover = mediaUrl(listing.images[0], layout === 'row' ? 240 : 480);
  const urgent = listing.boosts?.includes('ACIL');
  const featured = isFeatured(listing);
  const bold = listing.boosts?.includes('KALIN');
  const place = [listing.district, listing.city].filter(Boolean).join(', ');
  const extra = highlights(listing.attrs ?? {});

  const image = (
    <View style={[layout === 'row' ? styles.rowImage : styles.image, { backgroundColor: c.elevated }]}>
      {cover ? (
        <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} recyclingKey={listing.id} />
      ) : (
        <View style={styles.noImage}>
          <ImageOff size={22} color={c.subtle} />
        </View>
      )}
      {urgent || featured ? (
        <View style={styles.badges}>
          {urgent ? <Badge label="ACİL" tone="urgent" /> : null}
          {featured && layout !== 'row' ? <Badge label="VİTRİN" tone="primary" /> : null}
        </View>
      ) : null}
      {onFavorite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          hitSlop={8}
          onPress={onFavorite}
          style={styles.heart}
        >
          <Heart size={18} color={favorite ? '#f04438' : '#ffffff'} fill={favorite ? '#f04438' : 'rgba(0,0,0,0.25)'} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );

  const body = (
    <View style={layout === 'row' ? styles.rowBody : styles.body}>
      <Text variant="bodyStrong" style={[styles.price, { color: c.primary }]} numberOfLines={1}>
        {formatPrice(listing.price, listing.currency)}
      </Text>
      <Text variant="caption" numberOfLines={2} style={[styles.title, bold && styles.bold]}>
        {listing.title}
      </Text>
      {extra.length ? (
        <Text variant="small" tone="muted" numberOfLines={1}>
          {extra.join(' · ')}
        </Text>
      ) : null}
      <View style={styles.meta}>
        {place ? <MapPin size={11} color={c.subtle} /> : null}
        <Text variant="small" tone="subtle" numberOfLines={1} style={styles.flex}>
          {place || listing.category_name || ''}
        </Text>
        {layout !== 'rail' ? (
          <Text variant="small" tone="subtle">
            {timeAgo(listing.created_at)}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${formatPrice(listing.price, listing.currency)}`}
      onPress={onPress}
      style={({ pressed }) => [
        layout === 'row' ? styles.row : styles.card,
        layout === 'rail' && styles.rail,
        { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
        urgent && layout === 'row' && { borderColor: c.urgent },
      ]}
    >
      {image}
      {body}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { flex: 1, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  rail: { width: 168, flex: 0 },
  image: { width: '100%', aspectRatio: 4 / 3 },
  noImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badges: { position: 'absolute', left: space.sm, top: space.sm, flexDirection: 'row', gap: space.xs },
  heart: {
    position: 'absolute',
    right: space.xs,
    top: space.xs,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: space.sm + 2, gap: 3 },
  price: { fontSize: 16 },
  title: { minHeight: 36 },
  bold: { fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  row: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    minHeight: 110,
  },
  rowImage: { width: 128, alignSelf: 'stretch' },
  rowBody: { flex: 1, padding: space.md, gap: 3 },
});
