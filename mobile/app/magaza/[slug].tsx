import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Store } from 'lucide-react-native';
import { ListingCard, MobileListing } from '@/src/components/listing/ListingCard';
import { getMobileStore } from '@/src/api/client';
import { BrandColors } from '@/constants/Colors';

export default function StoreScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof getMobileStore>> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getMobileStore(slug).then((result) => { if (active) setData(result); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Mağaza yüklenemedi.'); });
    return () => { active = false; };
  }, [slug]);
  const listings: MobileListing[] = (data?.listings ?? []).map((item) => ({
    id: item.id, slug: item.slug, title: item.title, price: item.price, currency: item.currency, images: item.images,
    city: item.city, district: item.district, created_at: item.created_at, attrs: item.attrs, category_name: item.category_name,
    is_urgent: item.boosts?.includes('ACIL'), is_featured: item.boosts?.includes('KALIN'),
  }));
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: data?.store.name ?? 'Mağaza', headerLeft: () => <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color="#12151c" /></TouchableOpacity> }} />
      {data ? <FlatList data={listings} keyExtractor={(item) => item.id} numColumns={2} columnWrapperStyle={styles.columns} contentContainerStyle={styles.content}
        ListHeaderComponent={<>
          <View style={styles.storeCard}><Store size={28} color={BrandColors.primary} /><View style={styles.nameRow}><Text style={styles.name}>{data.store.name}</Text><Text style={styles.plan}>{data.store.plan}</Text></View>{data.store.description ? <Text style={styles.description}>{data.store.description}</Text> : null}{data.store.city ? <Text style={styles.city}>{data.store.city}</Text> : null}<TouchableOpacity onPress={() => router.push(`/satici/${data.store.user_id}` as any)}><Text style={styles.sellerLink}>Satıcı profili</Text></TouchableOpacity></View>
          <Text style={styles.sectionTitle}>Mağaza İlanları</Text>
        </>}
        ListEmptyComponent={<Text style={styles.empty}>Bu mağazada yayında ilan bulunmuyor.</Text>}
        renderItem={({ item }) => <View style={styles.card}><ListingCard listing={item} onPress={() => router.push(`/ilan/${item.id}` as any)} /></View>}
      /> : <View style={styles.center}>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={BrandColors.primary} />}</View>}
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#f3f5f8' }, content: { padding: 16, paddingBottom: 30 }, storeCard: { padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#fff', alignItems: 'flex-start' }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }, name: { color: '#12151c', fontSize: 20, fontWeight: '700' }, plan: { color: BrandColors.primary, fontSize: 11, fontWeight: '700', backgroundColor: '#eaf0ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 }, description: { color: '#5a6270', fontSize: 14, lineHeight: 20, marginTop: 9 }, city: { color: '#5a6270', fontSize: 13, marginTop: 7 }, sellerLink: { color: BrandColors.primary, fontSize: 13, fontWeight: '600', marginTop: 12 }, sectionTitle: { color: '#12151c', fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 12 }, columns: { gap: 10 }, card: { flex: 1, maxWidth: '50%', marginBottom: 10 }, empty: { color: '#5a6270', textAlign: 'center', paddingVertical: 28 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, error: { color: '#b42318', textAlign: 'center' },
});
