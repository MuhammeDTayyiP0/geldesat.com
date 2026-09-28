import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Share,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  MapPin,
  Calendar,
  Eye,
  Share2,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  Heart,
  Phone,
  MessageCircle,
} from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { ListingImageGallery } from '@/src/components/listing/ListingImageGallery';
import { StickyContactBar } from '@/src/components/listing/StickyContactBar';
import {
  LocalListing,
} from '@/src/store/localStore';
import { getMobileListing, revealMobileListingPhone, startMobileConversation, toggleMobileFavorite } from '@/src/api/client';
import { getStoredUser } from '@/src/api/auth';

export default function IlanDetayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [listing, setListing] = useState<LocalListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchListing() {
      setLoading(true);
      try {
        const user = await getStoredUser();
        const result = await getMobileListing(id, user?.token);
        if (isMounted) {
          const item = result.listing;
          setListing({
            id: item.id, title: item.title, price: item.price, currency: item.currency,
            description: item.description, city: item.city, district: item.district,
            images: item.images?.length ? item.images : [], attrs: item.attrs || {},
            created_at: item.created_at, category_name: item.category_name,
            category_slug: item.category_slug, seller_name: item.seller_name || 'GeldeSat Satıcısı',
            seller_id: item.user_id, store_name: item.store_name, store_slug: item.store_slug,
            status: item.status as LocalListing['status'], is_urgent: item.boosts?.includes('ACIL'),
            is_featured: item.boosts?.includes('KALIN'),
          });
          setIsFav(result.isFavorite);
        }
      } catch {
        // Hata durumunda sessiz kal
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (id) fetchListing();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleToggleFavorite = async () => {
    if (!listing) return;
    const user = await getStoredUser();
    if (!user?.token) {
      Alert.alert('Giriş gerekli', 'Favori ilanlarınızı hesabınızla eşitlemek için giriş yapın.', [
        { text: 'Vazgeç', style: 'cancel' }, { text: 'Giriş Yap', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }
    try {
      const result = await toggleMobileFavorite(listing.id, user.token);
      setIsFav(result.favorite);
    } catch (error) {
      Alert.alert('Favori güncellenemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.');
    }
  };

  const handleCall = async () => {
    if (!listing) return;
    if (phone) { await Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`); return; }
    const user = await getStoredUser();
    if (!user?.token) {
      Alert.alert('Giriş gerekli', 'Satıcının telefon numarasını görmek için giriş yapın.', [
        { text: 'Vazgeç', style: 'cancel' }, { text: 'Giriş Yap', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }
    try {
      const result = await revealMobileListingPhone(listing.id, user.token);
      setPhone(result.phone);
      await Linking.openURL(`tel:${result.phone.replace(/[^0-9+]/g, '')}`);
    } catch (error) {
      Alert.alert('Telefon alınamadı', error instanceof Error ? error.message : 'Satıcı telefon numarası paylaşmamış.');
    }
  };

  const handleMessage = async () => {
    if (!listing) return;
    const user = await getStoredUser();
    if (!user?.token) {
      Alert.alert('Giriş gerekli', 'Satıcıya mesaj göndermek için giriş yapın.', [
        { text: 'Vazgeç', style: 'cancel' }, { text: 'Giriş Yap', onPress: () => router.push('/login' as any) },
      ]);
      return;
    }
    try {
      const result = await startMobileConversation(listing.id, `Merhaba, "${listing.title}" ilanınız için yazıyorum. Hâlâ satılık mı?`, user.token);
      router.push(`/mesaj/${result.conversationId}` as any);
    } catch (error) {
      Alert.alert('Mesaj gönderilemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.');
    }
  };

  const handleShare = async () => {
    if (!listing) return;
    try {
      await Share.share({
        message: `${listing.title} - https://www.geldesat.com/ilan/${listing.id}`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a4fd8" />
        <Text style={styles.loadingText}>İlan yükleniyor...</Text>
      </View>
    );
  }

  // Web ile birebir İlan Bulunamadı Görünümü
  if (!listing) {
    return (
      <View style={styles.notFoundContainer}>
        <Stack.Screen options={{ headerTitle: 'İlan Bulunamadı' }} />
        <View style={styles.notFoundCard}>
          <AlertCircle size={48} color="#b42318" style={{ marginBottom: 12 }} />
          <Text style={styles.notFoundTitle}>İlan Bulunamadı veya Yayından Kaldırıldı</Text>
          <Text style={styles.notFoundDesc}>
            Aradığınız ilan satılmış, süresi dolmuş veya sahibi tarafından yayından kaldırılmış olabilir.
          </Text>
          <TouchableOpacity
            style={styles.notFoundBtn}
            onPress={() => router.replace('/(tabs)/kategoriler')}>
            <Text style={styles.notFoundBtnText}>İlanlara Göz At</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const formattedPrice = new Intl.NumberFormat('tr-TR').format(listing.price) + ' ' + (listing.currency || 'TL');

  const attrEntries = Object.entries(listing.attrs || {});

  return (
    <View style={styles.screenWrapper}>
      <Stack.Screen
        options={{
          headerTitle: 'İlan Detayı',
          headerRight: () => (
            <TouchableOpacity onPress={handleShare} style={{ marginRight: 8 }}>
              <Share2 size={20} color="#12151c" />
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

          <Text style={styles.titleText}>{listing.title}</Text>
          <Text style={styles.priceText}>{formattedPrice}</Text>

          {/* Konum & Tarih Meta Bilgileri */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MapPin size={14} color="#8a929e" />
              <Text style={styles.metaText}>
                {listing.city || 'Türkiye'}
                {listing.district ? ` / ${listing.district}` : ''}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Calendar size={14} color="#8a929e" />
              <Text style={styles.metaText}>
                {new Date(listing.created_at).toLocaleDateString('tr-TR')}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Satıcı Kartı */}
        <View style={styles.sellerCard}>
          <TouchableOpacity style={styles.sellerIdentity} onPress={() => listing.seller_id && router.push(`/satici/${listing.seller_id}` as any)} disabled={!listing.seller_id}>
          <View style={styles.sellerAvatar}>
            <Text style={styles.sellerAvatarLetter}>
              {listing.seller_name ? listing.seller_name.charAt(0).toUpperCase() : 'S'}
            </Text>
          </View>
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName}>{listing.seller_name || 'GeldeSat Satıcısı'}</Text>
            <Text style={styles.sellerBadge}>Doğrulanmış Üye</Text>
          </View>
          </TouchableOpacity>
          {listing.store_slug ? <TouchableOpacity onPress={() => router.push(`/magaza/${listing.store_slug}` as any)}><Text style={styles.storeLink}>{listing.store_name || 'Mağazayı Gör'}</Text></TouchableOpacity> : null}
          <TouchableOpacity style={styles.sellerMsgBtn} onPress={handleMessage}>
            <MessageCircle size={16} color="#1a4fd8" />
            <Text style={styles.sellerMsgBtnText}>Mesaj</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Teknik Detay Tablosu (Attributes) */}
        {attrEntries.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeaderTitle}>İlan Özellikleri</Text>
            <View style={styles.attributesTable}>
              {attrEntries.map(([key, val], index) => (
                <View
                  key={key}
                  style={[
                    styles.attrRow,
                    index % 2 === 0 ? styles.attrRowEven : styles.attrRowOdd,
                  ]}>
                  <Text style={styles.attrLabel}>{key}</Text>
                  <Text style={styles.attrValue}>{String(val)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 5. Açıklama */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>Açıklama</Text>
          <Text style={styles.descriptionText}>{listing.description}</Text>
        </View>

        {/* 6. Güvenli Alışveriş İpuçları */}
        <View style={styles.safetyCard}>
          <ShieldCheck size={20} color="#1f7a4d" style={{ marginRight: 10 }} />
          <Text style={styles.safetyText}>
            Tanımadığınız kişilere kapora yatırmayın. Ürünü görmeden para göndermeyin.
          </Text>
        </View>
      </ScrollView>

      {/* 7. Alt Sabit İletişim Barı */}
      <StickyContactBar
        price={listing.price}
        currency={listing.currency}
        phone={phone}
        listingTitle={listing.title}
        isFavorite={isFav}
        onFavoriteToggle={handleToggleFavorite}
        onChatPress={handleMessage}
        onCallPress={handleCall}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#f3f5f8', // Web: --color-bg
  },
  scrollContent: {
    paddingBottom: 90,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f5f8',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#5a6270',
  },
  notFoundContainer: {
    flex: 1,
    backgroundColor: '#f3f5f8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notFoundCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#12151c',
    textAlign: 'center',
    marginBottom: 8,
  },
  notFoundDesc: {
    fontSize: 12,
    color: '#5a6270',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  notFoundBtn: {
    backgroundColor: '#1a4fd8',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  notFoundBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Başlık Kartı
  headerCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d8dee6',
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  urgentBadge: {
    backgroundColor: '#b42318',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  featuredBadge: {
    backgroundColor: '#1a4fd8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#12151c',
    lineHeight: 24,
    marginBottom: 8,
  },
  priceText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a4fd8',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f5f8',
    paddingTop: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#5a6270',
  },

  // Satıcı Kartı
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d8dee6',
    marginBottom: 10,
  },
  sellerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  storeLink: { color: '#1a4fd8', fontSize: 12, fontWeight: '600', marginRight: 8 },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sellerAvatarLetter: {
    color: '#1a4fd8',
    fontSize: 18,
    fontWeight: '700',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#12151c',
  },
  sellerBadge: {
    fontSize: 11,
    color: '#1f7a4d',
    fontWeight: '500',
    marginTop: 2,
  },
  sellerMsgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f5f8',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d8dee6',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sellerMsgBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a4fd8',
  },

  // Bölüm Kartları
  sectionCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d8dee6',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#12151c',
    marginBottom: 12,
  },
  attributesTable: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    overflow: 'hidden',
  },
  attrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  attrRowEven: {
    backgroundColor: '#f8fafc',
  },
  attrRowOdd: {
    backgroundColor: '#ffffff',
  },
  attrLabel: {
    fontSize: 12,
    color: '#5a6270',
    fontWeight: '500',
  },
  attrValue: {
    fontSize: 12,
    color: '#12151c',
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 13,
    color: '#12151c',
    lineHeight: 20,
  },

  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    marginHorizontal: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 16,
  },
  safetyText: {
    flex: 1,
    fontSize: 11,
    color: '#065f46',
    lineHeight: 16,
  },
});
