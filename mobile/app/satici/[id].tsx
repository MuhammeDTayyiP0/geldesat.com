import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Star, Store } from 'lucide-react-native';
import { ListingCard, MobileListing } from '@/src/components/listing/ListingCard';
import { getMobileSeller } from '@/src/api/client';
import { BrandColors } from '@/constants/Colors';

export default function SellerScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof getMobileSeller>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getMobileSeller(id).then((result) => { if (active) setData(result); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Satıcı profili yüklenemedi.'); });
    return () => { active = false; };
  }, [id]);

  const listings: MobileListing[] = (data?.listings ?? []).map((item) => ({
    id: item.id, slug: item.slug, title: item.title, price: item.price, currency: item.currency, images: item.images,
    city: item.city, district: item.district, created_at: item.created_at, attrs: item.attrs, category_name: item.category_name,
    is_urgent: item.boosts?.includes('ACIL'), is_featured: item.boosts?.includes('KALIN'),
  }));

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: data?.seller.name ?? 'Satıcı Profili', headerLeft: () => <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color="#12151c" /></TouchableOpacity> }} />
      {data ? <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<>
          <View style={styles.profileCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{data.seller.name.charAt(0).toLocaleUpperCase('tr')}</Text></View>
            <Text style={styles.name}>{data.seller.name}</Text>
            <Text style={styles.meta}><Star size={14} color="#d28a00" /> {data.seller.rating_avg.toFixed(1)} ({data.seller.rating_count} değerlendirme) · {data.seller.listing_count} ilan{data.seller.city ? ` · ${data.seller.city}` : ''}</Text>
            {data.seller.bio ? <Text style={styles.bio}>{data.seller.bio}</Text> : null}
            {data.seller.store ? <TouchableOpacity style={styles.storeLink} onPress={() => router.push(`/magaza/${data.seller.store!.slug}` as any)}><Store size={16} color={BrandColors.primary} /><Text style={styles.storeLinkText}>{data.seller.store.name} mağazası</Text></TouchableOpacity> : null}
          </View>
          <Text style={styles.sectionTitle}>İlanları</Text>
        </>}
        ListEmptyComponent={<Text style={styles.empty}>Bu satıcının yayında ilanı bulunmuyor.</Text>}
        renderItem={({ item }) => <View style={styles.card}><ListingCard listing={item} onPress={() => router.push(`/ilan/${item.id}` as any)} /></View>}
        ListFooterComponent={data.seller.reviews.length ? <View style={styles.reviews}><Text style={styles.sectionTitle}>Yorumlar</Text>{data.seller.reviews.map((review) => <View key={review.id} style={styles.review}><Text style={styles.reviewName}>{review.reviewer} · {review.rating}/5</Text><Text style={styles.reviewBody}>{review.comment || 'Yorum eklenmemiş.'}</Text></View>)}</View> : null}
      /> : <View style={styles.center}>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={BrandColors.primary} />}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f5f8' }, content: { padding: 16, paddingBottom: 30 }, profileCard: { padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#fff', alignItems: 'center' }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: BrandColors.primary, fontSize: 24, fontWeight: '700' }, name: { marginTop: 10, color: '#12151c', fontWeight: '700', fontSize: 20 }, meta: { marginTop: 8, color: '#5a6270', fontSize: 12, textAlign: 'center' }, bio: { color: '#333b48', fontSize: 14, lineHeight: 21, marginTop: 12, textAlign: 'center' }, storeLink: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 }, storeLinkText: { color: BrandColors.primary, fontSize: 13, fontWeight: '600' }, sectionTitle: { color: '#12151c', fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 12 }, columns: { gap: 10 }, card: { flex: 1, maxWidth: '50%', marginBottom: 10 }, empty: { color: '#5a6270', textAlign: 'center', paddingVertical: 28 }, reviews: { marginTop: 4 }, review: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8dee6', borderRadius: 10, padding: 14, marginBottom: 9 }, reviewName: { color: '#12151c', fontSize: 13, fontWeight: '600' }, reviewBody: { color: '#5a6270', fontSize: 13, lineHeight: 19, marginTop: 5 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, error: { color: '#b42318', textAlign: 'center' },
});
