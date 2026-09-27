import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Heart, MapPin, ImageIcon } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';

const { width } = Dimensions.get('window');
const GRID_CARD_WIDTH = (width - 36) / 2;

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
}

interface ListingCardProps {
  listing: MobileListing;
  variant?: 'grid' | 'list' | 'feed';
  onPress?: () => void;
  onFavoritePress?: (id: string, isFav: boolean) => void;
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
}: ListingCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  const img = listing.images?.[0];
  const locationText = [listing.city, listing.district].filter(Boolean).join(' / ') || 'Konum yok';
  const attrPills = listing.attrs ? Object.values(listing.attrs).slice(0, 3) : [];

  const handleFavoriteToggle = () => {
    const nextState = !isFavorite;
    setIsFavorite(nextState);
    if (onFavoritePress) {
      onFavoritePress(listing.id, nextState);
    }
  };

  const media = (
    <View style={variant === 'list' ? styles.listMedia : variant === 'feed' ? styles.feedMedia : styles.gridMedia}>
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
      <TouchableOpacity
        style={styles.favButton}
        onPress={handleFavoriteToggle}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Heart
          size={14}
          color={isFavorite ? '#b42318' : '#12151c'}
          fill={isFavorite ? '#b42318' : 'transparent'}
        />
      </TouchableOpacity>
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
      style={variant === 'list' ? styles.listCard : variant === 'feed' ? styles.feedCard : styles.gridCard}
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
    width: GRID_CARD_WIDTH,
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
    height: (GRID_CARD_WIDTH * 3) / 4,
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
