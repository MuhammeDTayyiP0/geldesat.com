import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MapPin, Navigation, Search } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { getMobileListings } from '@/src/api/client';

export default function MapScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<Awaited<ReturnType<typeof getMobileListings>>['listings']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getMobileListings({ limit: 48 }).then((result) => {
      if (!active) return;
      if (!result.success) throw new Error(result.error || 'İlanlar yüklenemedi.');
      setListings(result.listings);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'İlanlar yüklenemedi.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const byCity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of listings) if (listing.city) counts.set(listing.city, (counts.get(listing.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [listings]);

  const openMap = async (lat?: number | null, lng?: number | null) => {
    const url = lat != null && lng != null
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=12/${lat}/${lng}`
      : 'https://www.openstreetmap.org/?bbox=25.6%2C35.8%2C45.0%2C42.4';
    await Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Harita' }} />
      <FlatList
        data={listings.filter((item) => item.lat != null && item.lng != null)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<>
          <Text style={styles.title}>Harita</Text>
          <Text style={styles.subtitle}>İlan konumlarını haritada açın veya yayındaki ilanları illere göre keşfedin.</Text>
          <TouchableOpacity style={styles.mapCard} onPress={() => void openMap()} activeOpacity={0.85}>
            <View style={styles.mapGraphic}><MapPin size={32} color={BrandColors.primary} /><View style={styles.mapDot} /><View style={styles.mapDotSecond} /></View>
            <View style={styles.mapCopy}><Text style={styles.mapTitle}>Türkiye haritasını aç</Text><Text style={styles.mapSubtitle}>Harita OpenStreetMap'te görüntülenir.</Text></View>
            <Navigation size={19} color={BrandColors.primary} />
          </TouchableOpacity>
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>İllere göre</Text><Text style={styles.muted}>{listings.length} güncel ilan</Text></View>
          {loading ? <ActivityIndicator style={styles.loader} color={BrandColors.primary} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && byCity.length === 0 ? <Text style={styles.empty}>Şu anda haritada gösterilecek ilan bulunmuyor.</Text> : null}
          {byCity.map(([city, count]) => <TouchableOpacity key={city} style={styles.cityRow} onPress={() => router.push({ pathname: '/(tabs)/kategoriler', params: { city } } as any)}>
            <View style={styles.cityIcon}><MapPin size={17} color={BrandColors.primary} /></View><Text style={styles.cityName}>{city}</Text><Text style={styles.cityCount}>{count} ilan</Text><Search size={16} color="#8a929e" />
          </TouchableOpacity>)}
          <Text style={styles.sectionTitle}>Haritadaki ilanlar</Text>
        </>}
        renderItem={({ item }) => <TouchableOpacity style={styles.listingRow} onPress={() => router.push(`/ilan/${item.id}` as any)}>
          <View style={styles.listingIcon}><MapPin size={17} color={BrandColors.primary} /></View><View style={styles.listingCopy}><Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.listingPlace}>{[item.city, item.district].filter(Boolean).join(' / ')}</Text></View>
          <TouchableOpacity style={styles.openPin} onPress={() => void openMap(item.lat, item.lng)}><Text style={styles.openPinText}>Haritada aç</Text></TouchableOpacity>
        </TouchableOpacity>}
        ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>Konumu belirlenmiş ilan bulunmuyor.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f5f8' }, content: { padding: 16, paddingBottom: 32 }, title: { color: '#12151c', fontSize: 24, fontWeight: '700', letterSpacing: -0.4 }, subtitle: { color: '#5a6270', fontSize: 13, lineHeight: 19, marginTop: 6 }, mapCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#d8dee6', borderRadius: 12, backgroundColor: '#fff', padding: 14, marginTop: 18 }, mapGraphic: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: '#eaf0ff', position: 'relative' }, mapDot: { position: 'absolute', right: 9, top: 11, width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef5a4f' }, mapDotSecond: { position: 'absolute', left: 12, bottom: 11, width: 6, height: 6, borderRadius: 3, backgroundColor: '#1f7a4d' }, mapCopy: { flex: 1 }, mapTitle: { color: '#12151c', fontSize: 14, fontWeight: '700' }, mapSubtitle: { color: '#5a6270', fontSize: 11, marginTop: 4 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 }, sectionTitle: { color: '#12151c', fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 9 }, muted: { color: '#8a929e', fontSize: 12 }, loader: { paddingVertical: 20 }, cityRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9, marginBottom: 7 }, cityIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#eaf0ff' }, cityName: { flex: 1, color: '#12151c', fontSize: 14, fontWeight: '600' }, cityCount: { color: '#5a6270', fontSize: 12 }, listingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9, padding: 11, marginBottom: 7 }, listingIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#eaf0ff' }, listingCopy: { flex: 1, minWidth: 0 }, listingTitle: { color: '#12151c', fontSize: 13, fontWeight: '600' }, listingPlace: { color: '#8a929e', fontSize: 11, marginTop: 3 }, openPin: { paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#eaf0ff', borderRadius: 7 }, openPinText: { color: BrandColors.primary, fontSize: 11, fontWeight: '600' }, empty: { color: '#5a6270', textAlign: 'center', paddingVertical: 18 }, error: { color: '#b42318', paddingVertical: 14 },
});
