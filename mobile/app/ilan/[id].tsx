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
  Modal,
  TextInput,
  Pressable,
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
  Pencil,
  Phone,
  MessageCircle,
  Star,
  Flag,
  Navigation,
} from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { ListingImageGallery } from '@/src/components/listing/ListingImageGallery';
import { StickyContactBar } from '@/src/components/listing/StickyContactBar';
import {
  LocalListing,
} from '@/src/store/localStore';
import { getMobileListing, revealMobileListingPhone, reportMobileListing, startMobileConversation, submitMobileReview, toggleMobileFavorite } from '@/src/api/client';
import { getStoredUser } from '@/src/api/auth';
import { ListingCard } from '@/src/components/listing/ListingCard';

export default function IlanDetayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [listing, setListing] = useState<LocalListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFav, setIsFav] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [detailData, setDetailData] = useState<Awaited<ReturnType<typeof getMobileListing>> | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchListing() {
      setLoading(true);
      setLoadError(null);
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
            expires_at: item.expires_at,
            lat: item.lat,
            lng: item.lng,
          });
          setIsFav(result.isFavorite);
          setIsOwner(result.isOwner);
          setDetailData(result);
          setReviewRating(result.reviewEligibility.existing?.rating ?? 0);
          setReviewComment(result.reviewEligibility.existing?.comment ?? '');
        }
      } catch (error) {
        if (isMounted) setLoadError(error instanceof Error ? error.message : 'İlan yüklenemedi.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (id) fetchListing();
    return () => {
      isMounted = false;
    };
  }, [id, reloadKey]);

  const handleToggleFavorite = async () => {
    if (!listing || isOwner) return;
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
    if (!listing || isOwner) return;
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
    if (!listing || isOwner) return;
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

  const handleReport = async () => {
    const user = await getStoredUser();
    if (!user?.token) {
      Alert.alert('Giriş gerekli', 'İlan bildirmek için giriş yapın.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Giriş Yap', onPress: () => router.push('/login' as any) }]);
      return;
    }
    if (!reportReason) { Alert.alert('Neden seçin', 'İlanı bildirmek için bir neden seçin.'); return; }
    setReportBusy(true);
    try {
      await reportMobileListing(listing!.id, reportReason, reportDetails, user.token);
      setReportOpen(false); setReportReason(''); setReportDetails('');
      Alert.alert('Bildirim alındı', 'İlanı inceleyeceğiz. Teşekkür ederiz.');
    } catch (error) { Alert.alert('Bildirim gönderilemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.'); }
    finally { setReportBusy(false); }
  };

  const handleReviewSubmit = async () => {
    if (!listing || !reviewRating) { Alert.alert('Puan seçin', 'Satıcıya 1 ile 5 yıldız arasında puan verin.'); return; }
    const user = await getStoredUser();
    if (!user?.token) { router.push('/login' as any); return; }
    setReviewBusy(true);
    try {
      await submitMobileReview(listing.id, reviewRating, reviewComment, user.token);
      const refreshed = await getMobileListing(listing.id, user.token);
      setDetailData(refreshed);
      Alert.alert('Değerlendirme kaydedildi', 'Satıcı puanınız güncellendi.');
    } catch (error) { Alert.alert('Kaydedilemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.'); }
    finally { setReviewBusy(false); }
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
          <Text style={styles.notFoundTitle}>{loadError ? 'İlan yüklenemedi' : 'İlan Bulunamadı veya Yayından Kaldırıldı'}</Text>
          <Text style={styles.notFoundDesc}>
            {loadError || 'Aradığınız ilan satılmış, süresi dolmuş veya sahibi tarafından yayından kaldırılmış olabilir.'}
          </Text>
          {loadError ? <TouchableOpacity style={styles.retryDetailBtn} onPress={() => setReloadKey((key) => key + 1)}><Text style={styles.notFoundBtnText}>Yeniden Dene</Text></TouchableOpacity> : null}
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
            <View style={styles.headerActions}>
              {!isOwner ? <TouchableOpacity onPress={() => setReportOpen(true)} style={styles.headerActionButton} accessibilityLabel="İlanı bildir"><Flag size={18} color="#5a6270" /></TouchableOpacity> : null}
              <TouchableOpacity onPress={handleShare} style={styles.headerActionButton} accessibilityLabel="İlanı paylaş"><Share2 size={19} color="#12151c" /></TouchableOpacity>
            </View>
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

        {detailData?.history && detailData.history.length > 1 ? <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>Fiyat geçmişi</Text>
          <Text style={styles.priceHistorySummary}>{detailData.history[0].price < listing.price ? 'Fiyat güncellendi' : 'İlk ilan fiyatı'} · {new Intl.NumberFormat('tr-TR').format(detailData.history[0].price)} TL → {formattedPrice}</Text>
          {detailData.history.slice(-5).map((entry, index) => <View key={`${entry.at}-${index}`} style={styles.historyRow}><Text style={styles.historyDate}>{new Date(entry.at).toLocaleDateString('tr-TR')}</Text><Text style={styles.historyPrice}>{new Intl.NumberFormat('tr-TR').format(entry.price)} TL</Text></View>)}
        </View> : null}

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
            {detailData?.sellerStats?.rating_count ? <View style={styles.sellerRating}><Star size={13} color="#e0a000" fill="#e0a000" /><Text style={styles.sellerRatingText}>{detailData.sellerStats.rating_avg.toFixed(1)} ({detailData.sellerStats.rating_count})</Text></View> : null}
          </View>
          </TouchableOpacity>
          {listing.store_slug ? <TouchableOpacity onPress={() => router.push(`/magaza/${listing.store_slug}` as any)}><Text style={styles.storeLink}>{listing.store_name || 'Mağazayı Gör'}</Text></TouchableOpacity> : null}
          {!isOwner ? <TouchableOpacity style={styles.sellerMsgBtn} onPress={handleMessage}>
            <MessageCircle size={16} color="#1a4fd8" />
            <Text style={styles.sellerMsgBtnText}>Mesaj</Text>
          </TouchableOpacity> : null}
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

        {listing.lat != null && listing.lng != null ? <View style={styles.mapCard}>
          <View style={styles.mapHeader}><MapPin size={18} color="#1a4fd8" /><Text style={styles.sectionHeaderTitle}>İlan konumu</Text></View>
          <Text style={styles.mapAddress}>{[listing.district, listing.city].filter(Boolean).join(' / ') || 'Yaklaşık konum'}</Text>
          <TouchableOpacity style={styles.mapButton} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`)}><Navigation size={16} color="#1a4fd8" /><Text style={styles.mapButtonText}>Haritada aç</Text></TouchableOpacity>
        </View> : null}

        {detailData?.reviews?.length ? <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>Satıcı değerlendirmeleri</Text>
          {detailData.reviews.map((review) => <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeading}><Text style={styles.reviewName}>{review.reviewer}</Text><Text style={styles.reviewRating}>★ {review.rating}/5</Text></View>
            {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
            <Text style={styles.reviewDate}>{new Date(review.at).toLocaleDateString('tr-TR')}</Text>
          </View>)}
        </View> : null}

        {!isOwner && detailData?.reviewEligibility.eligible ? <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>Satıcıyı değerlendir</Text>
          <Text style={styles.reviewHint}>Bu satıcıyla mesajlaştınız. Deneyiminizi puanlayabilirsiniz.</Text>
          <View style={styles.starPicker}>{[1, 2, 3, 4, 5].map((star) => <TouchableOpacity key={star} onPress={() => setReviewRating(star)} hitSlop={5}><Star size={30} color={reviewRating >= star ? '#e0a000' : '#cbd2dc'} fill={reviewRating >= star ? '#e0a000' : 'transparent'} /></TouchableOpacity>)}</View>
          <TextInput value={reviewComment} onChangeText={setReviewComment} placeholder="Kısa bir yorum ekleyin (isteğe bağlı)" placeholderTextColor="#8a929e" multiline maxLength={400} style={styles.reviewInput} />
          <TouchableOpacity style={styles.reviewSubmit} onPress={handleReviewSubmit} disabled={reviewBusy}>{reviewBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.reviewSubmitText}>{detailData.reviewEligibility.existing ? 'Puanı Güncelle' : 'Puanı Gönder'}</Text>}</TouchableOpacity>
        </View> : null}

        {detailData?.similar?.length ? <View style={styles.similarSection}>
          <Text style={styles.sectionHeaderTitle}>Benzer ilanlar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
            {detailData.similar.map((item) => <ListingCard key={item.id} listing={item} onPress={() => router.push(`/ilan/${item.id}` as any)} />)}
          </ScrollView>
        </View> : null}
      </ScrollView>

      {/* 7. Alt Sabit İletişim Barı */}
      {isOwner ? <View style={styles.ownerBar}>
        <View style={styles.ownerPrice}><Text style={styles.ownerPriceLabel}>İlan fiyatı</Text><Text style={styles.ownerPriceValue}>{formattedPrice}</Text></View>
        <TouchableOpacity style={styles.manageButton} onPress={() => router.push({ pathname: '/(tabs)/ilan-ver', params: { id: listing.id } } as any)} accessibilityRole="button">
          <Pencil size={17} color="#fff" /><Text style={styles.manageButtonText}>İlanı Yönet</Text>
        </TouchableOpacity>
      </View> : <StickyContactBar
        price={listing.price}
        currency={listing.currency}
        phone={phone}
        listingTitle={listing.title}
        isFavorite={isFav}
        onFavoriteToggle={handleToggleFavorite}
        onChatPress={handleMessage}
        onCallPress={handleCall}
      />}

      <Modal transparent visible={reportOpen} animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={styles.reportBackdrop} onPress={() => setReportOpen(false)}>
          <Pressable style={styles.reportDialog} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.reportTitle}>İlanı bildir</Text>
            <Text style={styles.reportHint}>Bu ilanı neden bildirmek istiyorsunuz?</Text>
            {['Yanıltıcı veya sahte ilan', 'Uygunsuz içerik', 'Yanlış kategori ya da fiyat', 'Diğer'].map((reason) => <TouchableOpacity key={reason} style={[styles.reportReason, reportReason === reason && styles.reportReasonSelected]} onPress={() => setReportReason(reason)}><View style={[styles.radio, reportReason === reason && styles.radioSelected]} /><Text style={styles.reportReasonText}>{reason}</Text></TouchableOpacity>)}
            <TextInput value={reportDetails} onChangeText={setReportDetails} placeholder="Açıklama (isteğe bağlı)" placeholderTextColor="#8a929e" multiline maxLength={500} style={styles.reportInput} />
            <View style={styles.reportButtons}><TouchableOpacity style={styles.reportCancel} onPress={() => setReportOpen(false)}><Text style={styles.reportCancelText}>Vazgeç</Text></TouchableOpacity><TouchableOpacity style={styles.reportSubmit} onPress={handleReport} disabled={reportBusy}>{reportBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.reportSubmitText}>Bildir</Text>}</TouchableOpacity></View>
          </Pressable>
        </Pressable>
      </Modal>
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
  retryDetailBtn: { minHeight: 42, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, marginBottom: 9, backgroundColor: '#657083', borderRadius: 8 },

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
  ownerBar: { position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 78, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#d8dee6', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 10 },
  ownerPrice: { flex: 1 }, ownerPriceLabel: { fontSize: 11, color: '#8a929e' }, ownerPriceValue: { fontSize: 16, color: '#1a4fd8', fontWeight: '800' },
  manageButton: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, backgroundColor: '#1a4fd8', borderRadius: 10 }, manageButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', marginRight: 4 }, headerActionButton: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
  priceHistorySummary: { color: '#5a6270', fontSize: 12, marginBottom: 8 }, historyRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e8ecf1' }, historyDate: { color: '#7a8492', fontSize: 12 }, historyPrice: { color: '#12151c', fontSize: 12, fontWeight: '600' },
  sellerRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }, sellerRatingText: { color: '#7b5a00', fontSize: 11, fontWeight: '600' },
  mapCard: { marginHorizontal: 14, marginBottom: 12, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#fff' }, mapHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 }, mapAddress: { color: '#5a6270', fontSize: 12, marginTop: 8 }, mapButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 12, backgroundColor: '#eef2ff', borderRadius: 8 }, mapButtonText: { color: '#1a4fd8', fontSize: 13, fontWeight: '600' },
  reviewCard: { paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e8ecf1' }, reviewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, reviewName: { color: '#12151c', fontSize: 13, fontWeight: '600' }, reviewRating: { color: '#8a6800', fontSize: 12, fontWeight: '700' }, reviewComment: { color: '#4e5968', fontSize: 13, lineHeight: 19, marginTop: 5 }, reviewDate: { color: '#8a929e', fontSize: 10, marginTop: 5 }, reviewHint: { color: '#697483', fontSize: 12, lineHeight: 17 }, starPicker: { flexDirection: 'row', gap: 8, marginVertical: 12 }, reviewInput: { minHeight: 74, padding: 11, textAlignVertical: 'top', borderWidth: 1, borderColor: '#d8dee6', borderRadius: 8, color: '#12151c' }, reviewSubmit: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 10, backgroundColor: '#1a4fd8', borderRadius: 8 }, reviewSubmitText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  similarSection: { padding: 14, paddingBottom: 0 }, similarRow: { gap: 10, paddingTop: 10, paddingBottom: 4 },
  reportBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(10,16,28,0.48)' }, reportDialog: { padding: 18, borderRadius: 16, backgroundColor: '#fff' }, reportTitle: { color: '#12151c', fontSize: 18, fontWeight: '700' }, reportHint: { color: '#687382', fontSize: 13, marginTop: 4, marginBottom: 12 }, reportReason: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8ecf1' }, reportReasonSelected: { backgroundColor: '#f5f7ff' }, radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: '#aab3bf' }, radioSelected: { borderWidth: 5, borderColor: '#1a4fd8' }, reportReasonText: { color: '#28313d', fontSize: 13 }, reportInput: { minHeight: 72, textAlignVertical: 'top', padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#d8dee6', borderRadius: 8, color: '#12151c' }, reportButtons: { flexDirection: 'row', gap: 10, marginTop: 14 }, reportCancel: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f5f8', borderRadius: 8 }, reportCancelText: { color: '#4e5968', fontWeight: '600' }, reportSubmit: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a4fd8', borderRadius: 8 }, reportSubmitText: { color: '#fff', fontWeight: '700' },
});
