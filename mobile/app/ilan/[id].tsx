import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, Calendar, Eye, Share2, ShieldCheck, ChevronRight } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { ListingImageGallery } from '@/src/components/listing/ListingImageGallery';
import { StickyContactBar } from '@/src/components/listing/StickyContactBar';

export default function IlanDetayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isFav, setIsFav] = useState(false);

  // Örnek ilan detayı (Backend verisine tam uyumlu)
  const listing = {
    id: id || '1',
    title: '2021 BMW 320i M Sport Hatasız Boyasız Yetkili Servis Bakımlı',
    price: 2450000,
    currency: 'TL',
    description: `Araç 2021 model olup ilk sahibindendir. Tüm bakımları zamanında Borusan Oto yetkili servisinde yapılmıştır.
Hata, boya, tramer kaydı kesinlikle yoktur.
Kapalı garajda muhafaza edilmektedir.
Yedek anahtarı ve kitapçıkları mevcuttur.
Alıcısına şimdiden hayırlı olsun.`,
    city: 'İstanbul',
    district: 'Kadıköy',
    neighborhood: 'Caddebostan Mah.',
    created_at: '27 Eylül 2026',
    view_count: 842,
    is_urgent: true,
    is_featured: true,
    seller: {
      name: 'Ahmet Yılmaz',
      member_since: 'Ekim 2022',
      phone: '05321112233',
    },
    images: [
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1000&q=85',
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=1000&q=85',
      'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=1000&q=85',
    ],
    attributes: [
      { label: 'İlan No', value: `GS-${id || '10842'}` },
      { label: 'İlan Tarihi', value: '27 Eylül 2026' },
      { label: 'Marka', value: 'BMW' },
      { label: 'Seri', value: '3 Serisi' },
      { label: 'Model', value: '320i M Sport' },
      { label: 'Yıl', value: '2021' },
      { label: 'Yakıt', value: 'Benzin' },
      { label: 'Vites', value: 'Otomatik' },
      { label: 'Kilometre', value: '42.000 km' },
      { label: 'Kasa Tipi', value: 'Sedan' },
      { label: 'Motor Gücü', value: '170 hp' },
      { label: 'Renk', value: 'Füme / Antrasit' },
      { label: 'Kimden', value: 'Sahibinden' },
      { label: 'Takas', value: 'Evet (Araç ile)' },
      { label: 'Durumu', value: 'İkinci El' },
    ],
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${listing.title} - geldesat.com/ilan/${listing.id}`,
      });
    } catch {
      // Paylaşım iptal
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <Stack.Screen
        options={{
          headerTitle: 'İlan Detayı',
          headerRight: () => (
            <TouchableOpacity onPress={handleShare} style={{ marginRight: 8 }}>
              <Share2 size={20} color={BrandColors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Tam Ekran Destekli Görsel Galerisi */}
        <ListingImageGallery images={listing.images} title={listing.title} />

        {/* 2. Başlık ve Fiyat Alanı */}
        <View style={styles.headerCard}>
          <View style={styles.badgeRow}>
            {listing.is_urgent && (
              <View style={styles.urgentBadge}>
                <Text style={styles.badgeText}>ACİL</Text>
              </View>
            )}
            {listing.is_featured && (
              <View style={styles.featuredBadge}>
                <Text style={styles.badgeText}>ÖNE ÇIKAN</Text>
              </View>
            )}
          </View>

          <Text style={styles.priceText}>
            {new Intl.NumberFormat('tr-TR').format(listing.price)} {listing.currency}
          </Text>

          <Text style={styles.titleText}>{listing.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MapPin size={13} color={BrandColors.textMuted} style={{ marginRight: 4 }} />
              <Text style={styles.metaText}>
                {listing.city}, {listing.district}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Calendar size={13} color={BrandColors.textMuted} style={{ marginRight: 4 }} />
              <Text style={styles.metaText}>{listing.created_at}</Text>
            </View>
            <View style={styles.metaItem}>
              <Eye size={13} color={BrandColors.textMuted} style={{ marginRight: 4 }} />
              <Text style={styles.metaText}>{listing.view_count}</Text>
            </View>
          </View>
        </View>

        {/* 3. Sahibinden Tarzı Detaylı Özellikler Tablosu */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Teknik Özellikler</Text>
          <View style={styles.attrTable}>
            {listing.attributes.map((attr, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <View key={attr.label} style={[styles.attrRow, isEven && styles.attrRowEven]}>
                  <Text style={styles.attrLabel}>{attr.label}</Text>
                  <Text style={styles.attrValue}>{attr.value}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 4. İlan Açıklaması */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Açıklama</Text>
          <Text style={styles.descText}>{listing.description}</Text>
        </View>

        {/* 5. Satıcı Bilgi Kartı */}
        <View style={styles.card}>
          <View style={styles.sellerHeader}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerInitial}>{listing.seller.name[0]}</Text>
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{listing.seller.name}</Text>
              <Text style={styles.sellerSince}>Üyelik: {listing.seller.member_since}</Text>
            </View>
            <ShieldCheck size={24} color={BrandColors.success} />
          </View>

          <TouchableOpacity style={styles.otherAdsBtn} activeOpacity={0.7}>
            <Text style={styles.otherAdsText}>Satıcının Diğer İlanları</Text>
            <ChevronRight size={16} color={BrandColors.primary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 6. Sabit Alt İletişim Barı (Sticky Contact Bar) */}
      <StickyContactBar
        price={listing.price}
        currency={listing.currency}
        phone={listing.seller.phone}
        listingTitle={listing.title}
        isFavorite={isFav}
        onFavoriteToggle={() => setIsFav(!isFav)}
        onChatPress={() => router.push('/(tabs)/mesajlar')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  scrollContent: {
    paddingBottom: 90, // Alt iletişim barının altında kalmaması için
  },
  headerCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.border,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  urgentBadge: {
    backgroundColor: BrandColors.danger,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  featuredBadge: {
    backgroundColor: BrandColors.warning,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  priceText: {
    fontSize: 22,
    fontWeight: '900',
    color: BrandColors.primary,
    marginBottom: 8,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: BrandColors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: BrandColors.borderLight,
    paddingTop: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: BrandColors.textSecondary,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: BrandColors.text,
    marginBottom: 12,
  },
  // Özellikler Tablosu
  attrTable: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BrandColors.borderLight,
  },
  attrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  attrRowEven: {
    backgroundColor: '#f8fafc',
  },
  attrLabel: {
    fontSize: 12,
    color: BrandColors.textSecondary,
    fontWeight: '500',
  },
  attrValue: {
    fontSize: 12,
    color: BrandColors.text,
    fontWeight: '700',
  },
  descText: {
    fontSize: 13,
    color: BrandColors.text,
    lineHeight: 20,
  },
  // Satıcı Kartı
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sellerInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: BrandColors.primary,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: '700',
    color: BrandColors.text,
    marginBottom: 2,
  },
  sellerSince: {
    fontSize: 11,
    color: BrandColors.textSecondary,
  },
  otherAdsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BrandColors.borderLight,
  },
  otherAdsText: {
    fontSize: 13,
    fontWeight: '600',
    color: BrandColors.primary,
  },
});
