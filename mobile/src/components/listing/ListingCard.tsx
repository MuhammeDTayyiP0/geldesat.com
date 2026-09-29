import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, useWindowDimensions, Alert } from 'react-native';
import { useEffect } from 'react';
import { Heart, MapPin, ImageIcon, Store } from 'lucide-react-native';
import { getStoredUser } from '@/src/api/auth';
import { API_BASE_URL, toggleMobileFavorite } from '@/src/api/client';


export interface MobileListing {
  id: string;
  slug?: string;
  title: string;
  price: number;
  currency?: string;
  images: string[];
  city?: string | null;
  district?: string | null;
  created_at: string;
  is_urgent?: boolean;
  is_featured?: boolean;
  attrs?: Record<string, string | number>;
  category_name?: string;
  seller_name?: string;
  store_name?: string | null;
  user_id?: string;
}

interface ListingCardProps {
  listing: MobileListing;
  variant?: 'grid' | 'list' | 'feed';
  onPress?: () => void;
  onFavoritePress?: (id: string, isFav: boolean) => void;
  isFavorite?: boolean;
  isOwner?: boolean;
}

function formatPrice(amount: number, currency: string = 'TL') {
  return new Intl.NumberFormat('tr-TR').format(amount) + ' ' + currency;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(d);
}

export function ListingCard({
  listing,
  variant = 'grid',
  onPress,
  onFavoritePress,
  isFavorite: initialFavorite = false,
  isOwner: ownerOverride = false,
}: ListingCardProps) {
  const { width } = useWindowDimensions();
  const gridCardWidth = Math.max(140, (width - 36) / 2);
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => setIsFavorite(initialFavorite), [initialFavorite]);
  useEffect(() => { let active = true; void getStoredUser().then((user) => { if (active) setCurrentUserId(user?.id ?? null); }); return () => { active = false; }; }, []);
  const isOwner = ownerOverride || Boolean(currentUserId && listing.user_id && currentUserId === listing.user_id);

  const rawImage = listing.images?.[0];
  const img = rawImage?.startsWith('/') ? `${API_BASE_URL}${rawImage}` : rawImage;
  const locationText = [listing.city, listing.district].filter(Boolean).join(' / ') || 'Konum yok';
  const attrPills = listing.attrs ? Object.values(listing.attrs).slice(0, 3) : [];

  const handleFavoriteToggle = async () => {
    if (favoriteBusy) return;
    if (onFavoritePress) {
      const nextState = !isFavorite;
      setIsFavorite(nextState);
      onFavoritePress(listing.id, nextState);
      return;
    }
    const user = await getStoredUser();
    if (!user?.token) {
      Alert.alert('Giriş gerekli', 'Favori ilanlarınızı hesabınızla eşitlemek için giriş yapın.');
      return;
    }
    setFavoriteBusy(true);
    try {
      const result = await toggleMobileFavorite(listing.id, user.token);
      setIsFavorite(result.favorite);
    } catch (error) {
      Alert.alert('Favori güncellenemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.');
    } finally {
      setFavoriteBusy(false);
    }
  };

  const media = (
    <View style={variant === 'list' ? styles.listMedia : variant === 'feed' ? styles.feedMedia : [styles.gridMedia, { height: gridCardWidth * 0.75 }]}>
      {img ? (
        <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.noImageBox}>
          <ImageIcon size={24} color="#8a929e" />
          <Text style={styles.noImageText}>{listing.category_name || 'Fotoğraf yok'}</Text>
        </View>
      )}

      {/* Web'deki birebir rozetler */}
      <View style={styles.badgesWrapper}>
        {listing.is_featured ? (
          <View style={styles.vitrinBadge}>
            <Text style={styles.vitrinBadgeText}>Vitrin</Text>
          </View>
        ) : null}
        {listing.is_urgent ? (
          <View style={styles.acilBadge}>
            <Text style={styles.acilBadgeText}>Acil</Text>
          </View>
        ) : null}
      </View>

      {/* Web'deki favori butonu */}
      {!isOwner ? <TouchableOpacity
        style={styles.favButton}
        onPress={(event) => { event.stopPropagation(); void handleFavoriteToggle(); }}
        disabled={favoriteBusy}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Heart
          size={14}
          color={isFavorite ? '#b42318' : '#12151c'}
          fill={isFavorite ? '#b42318' : 'transparent'}
        />
      </TouchableOpacity> : null}
    </View>
  );

  const body = (
    <View style={variant === 'list' ? styles.listBody : styles.gridBody}>
      {/* Fiyat (Web'deki font ve renk) */}
      <Text style={styles.price}>{formatPrice(listing.price, listing.currency)}</Text>

      {/* Başlık */}
      <Text style={styles.title} numberOfLines={2}>
        {listing.title}
      </Text>

      {listing.store_name || listing.seller_name ? (
        <View style={styles.sellerRow}>
          {listing.store_name ? <Store size={11} color="#5a6270" /> : null}
          <Text style={styles.sellerText} numberOfLines={1}>{listing.store_name || listing.seller_name}</Text>
        </View>
      ) : null}

      {/* Özellik Pilleri (Web'deki attrs) */}
      {attrPills.length > 0 && (
        <View style={styles.pillsRow}>
          {attrPills.map((val, idx) => (
            <View key={idx} style={styles.pill}>
              <Text style={styles.pillText} numberOfLines={1}>
                {String(val)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Alt Konum ve Tarih Satırı */}
      <View style={styles.footerRow}>
        <View style={styles.locationWrapper}>
          <MapPin size={11} color="#5a6270" style={{ marginRight: 3 }} />
          <Text style={styles.locationText} numberOfLines={1}>
            {locationText}
          </Text>
        </View>
        <Text style={styles.dateText}>{formatDate(listing.created_at)}</Text>
      </View>
    </View>
  );

  return (
    <TouchableOpacity
      style={variant === 'list' ? styles.listCard : variant === 'feed' ? styles.feedCard : [styles.gridCard, { width: gridCardWidth }]}
      onPress={onPress}
      activeOpacity={0.88}>
      {media}
      {body}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Web'deki rounded-xl border border-border bg-surface shadow-card
  gridCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    overflow: 'hidden',
    marginBottom: 12,
  },
  feedCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8dee6',
    overflow: 'hidden',
    marginBottom: 0,
    shadowColor: '#0d1117',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    overflow: 'hidden',
    marginBottom: 10,
  },

  // 4/3 Aspect Ratio
  gridMedia: {
    width: '100%',
    backgroundColor: '#eef1f5',
    position: 'relative',
  },
  feedMedia: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#eef1f5',
    position: 'relative',
  },
  listMedia: {
    width: 120,
    height: 105,
    backgroundColor: '#eef1f5',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImageBox: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  noImageText: {
    fontSize: 10,
    color: '#5a6270',
    marginTop: 4,
  },

  // Web Rozetleri: Vitrin (ink) ve Acil (danger)
  badgesWrapper: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    gap: 4,
  },
  vitrinBadge: {
    backgroundColor: '#0d1117',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vitrinBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  acilBadge: {
    backgroundColor: '#b42318',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  acilBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },

  // Web Favori Butonu
  favButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },

  // İçerik (Body)
  gridBody: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  listBody: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a4fd8',
    letterSpacing: -0.2,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: '#12151c',
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 6,
  },

  // Özellik Pilleri
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginBottom: 5,
  },
  sellerText: {
    color: '#5a6270',
    fontSize: 10,
    flexShrink: 1,
  },
  pill: {
    backgroundColor: '#eef1f5',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 9,
    color: '#5a6270',
    fontWeight: '500',
  },

  // Konum ve Tarih
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f4f8',
    paddingTop: 6,
    marginTop: 'auto',
  },
  locationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 4,
  },
  locationText: {
    fontSize: 10,
    color: '#5a6270',
    flex: 1,
  },
  dateText: {
    fontSize: 10,
    color: '#8a929e',
  },
});
