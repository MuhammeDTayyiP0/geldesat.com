import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking, Platform } from 'react-native';
import { Phone, MessageCircle, Heart } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';

interface StickyContactBarProps {
  price: number;
  currency?: string;
  phone?: string | null;
  listingTitle: string;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  onChatPress?: () => void;
}

export function StickyContactBar({
  price,
  currency = 'TL',
  phone,
  listingTitle,
  isFavorite = false,
  onFavoriteToggle,
  onChatPress,
}: StickyContactBarProps) {
  const formattedPrice = new Intl.NumberFormat('tr-TR').format(price) + ' ' + currency;

  const handleCall = () => {
    if (phone) {
      const clean = phone.replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${clean}`);
    } else {
      // Varsayılan telefon numarası veya bilgi
      Linking.openURL('tel:08500000000');
    }
  };

  const handleWhatsApp = () => {
    const clean = phone ? phone.replace(/[^0-9]/g, '') : '';
    const text = encodeURIComponent(`Merhaba, geldesat.com üzerindeki "${listingTitle}" ilanınızla ilgileniyorum.`);
    if (clean) {
      Linking.openURL(`https://wa.me/${clean}?text=${text}`);
    } else if (onChatPress) {
      onChatPress();
    }
  };

  return (
    <View style={styles.container}>
      {/* Fiyat ve Favori */}
      <View style={styles.priceContainer}>
        <Text style={styles.priceLabel}>Fiyat</Text>
        <Text style={styles.priceText} numberOfLines={1}>{formattedPrice}</Text>
      </View>

      {/* Aksiyon Butonları */}
      <View style={styles.actionsContainer}>
        {/* Favori Butonu */}
        <TouchableOpacity style={styles.favBtn} onPress={onFavoriteToggle} activeOpacity={0.7}>
          <Heart
            size={20}
            color={isFavorite ? BrandColors.danger : BrandColors.textSecondary}
            fill={isFavorite ? BrandColors.danger : 'transparent'}
          />
        </TouchableOpacity>

        {/* Mesaj / WhatsApp Butonu */}
        <TouchableOpacity style={styles.chatBtn} onPress={handleWhatsApp} activeOpacity={0.85}>
          <MessageCircle size={18} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.chatBtnText}>Mesaj</Text>
        </TouchableOpacity>

        {/* Ara Butonu (Sahibinden Tarzı Yeşil/Vurgulu Buton) */}
        <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.85}>
          <Phone size={18} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.callBtnText}>Ara</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 10,
  },
  priceContainer: {
    flex: 1,
    marginRight: 12,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: BrandColors.textMuted,
  },
  priceText: {
    fontSize: 17,
    fontWeight: '800',
    color: BrandColors.primary,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: BrandColors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366', // WhatsApp Yeşili
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 14,
  },
  chatBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 16,
  },
  callBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});
