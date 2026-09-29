import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MapPin, Search } from 'lucide-react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
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

  const selectCity = (city: string) => router.push({ pathname: '/(tabs)/kategoriler', params: { city } } as any);
  const markerFor = (lat: number, lng: number) => ({
    x: 20 + ((lng - 26) / 19) * 320,
    y: 18 + ((42.5 - lat) / 6.8) * 260,
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Harita' }} />
      <FlatList
        data={listings.filter((item) => item.lat != null && item.lng != null)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<>
          <Text style={styles.title}>Harita</Text>
          <Text style={styles.subtitle}>İlanları konumlarına göre keşfedin.</Text>
          <View style={styles.mapCard}>
            <View style={styles.mapTitleRow}><View><Text style={styles.mapTitle}>Türkiye’de ilanlar</Text><Text style={styles.mapSubtitle}>{byCity.length} ilde sonuç var</Text></View><MapPin size={18} color={BrandColors.primary} /></View>
            <Svg width="100%" height={250} viewBox="0 0 360 296" accessibilityLabel="İl merkezlerine göre ilan yoğunluğu haritası">
              <Path d="M16 108 L28 86 L52 80 L67 62 L92 68 L111 52 L133 61 L151 50 L169 62 L184 50 L203 59 L218 51 L236 62 L257 56 L273 73 L298 68 L319 82 L337 82 L341 98 L329 111 L342 123 L328 138 L333 155 L317 166 L306 184 L286 187 L275 205 L250 207 L236 222 L213 218 L193 232 L174 225 L153 236 L133 224 L113 228 L97 214 L77 219 L63 206 L44 204 L37 187 L21 177 L28 160 L16 147 L25 131 L14 120 Z" fill="#eaf0ff" stroke="#c9d6f5" strokeWidth="2" />
              {byCity.map(([city, count]) => {
                const listing = listings.find((item) => item.city === city && item.lat != null && item.lng != null);
                if (!listing || listing.lat == null || listing.lng == null) return null;
                const { x, y } = markerFor(listing.lat, listing.lng);
                const radius = Math.min(17, 7 + Math.log2(count + 1) * 2);
                return <Circle key={city} cx={x} cy={y} r={radius} fill="#1a4fd8" fillOpacity={0.88} stroke="#ffffff" strokeWidth="2" onPress={() => selectCity(city)} />;
              })}
              {byCity.slice(0, 8).map(([city]) => {
                const listing = listings.find((item) => item.city === city && item.lat != null && item.lng != null);
                if (!listing || listing.lat == null || listing.lng == null) return null;
                const { x, y } = markerFor(listing.lat, listing.lng);
                return <SvgText key={`label-${city}`} x={x} y={y - 12} fill="#243653" fontSize="8" fontWeight="700" textAnchor="middle">{city}</SvgText>;
              })}
            </Svg>
            <Text style={styles.mapFootnote}>İşaretçiler yaklaşık il merkezlerini gösterir; ilan adresini göstermez.</Text>
          </View>
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>İllere göre</Text><Text style={styles.muted}>{listings.length} ilan gösteriliyor</Text></View>
          {loading ? <ActivityIndicator style={styles.loader} color={BrandColors.primary} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && byCity.length === 0 ? <Text style={styles.empty}>Şu anda haritada gösterilecek ilan bulunmuyor.</Text> : null}
          {byCity.map(([city, count]) => <TouchableOpacity key={city} style={styles.cityRow} onPress={() => selectCity(city)}>
            <View style={styles.cityIcon}><MapPin size={17} color={BrandColors.primary} /></View><Text style={styles.cityName}>{city}</Text><Text style={styles.cityCount}>{count} ilan</Text><Search size={16} color="#8a929e" />
          </TouchableOpacity>)}
          <Text style={styles.sectionTitle}>Haritadaki ilanlar</Text>
        </>}
        renderItem={({ item }) => <TouchableOpacity style={styles.listingRow} onPress={() => router.push(`/ilan/${item.id}` as any)}>
          <View style={styles.listingIcon}><MapPin size={17} color={BrandColors.primary} /></View><View style={styles.listingCopy}><Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.listingPlace}>{[item.city, item.district].filter(Boolean).join(' / ')}</Text></View>
          <View style={styles.approximateChip}><Text style={styles.approximateText}>İl merkezi</Text></View>
        </TouchableOpacity>}
        ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>Konumu belirlenmiş ilan bulunmuyor.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f5f8' }, content: { padding: 16, paddingBottom: 32 }, title: { color: '#12151c', fontSize: 24, fontWeight: '700', letterSpacing: -0.4 }, subtitle: { color: '#5a6270', fontSize: 13, lineHeight: 19, marginTop: 6 }, mapCard: { borderWidth: 1, borderColor: '#d8dee6', borderRadius: 14, backgroundColor: '#fff', padding: 14, marginTop: 18, overflow: 'hidden' }, mapTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, mapTitle: { color: '#12151c', fontSize: 15, fontWeight: '700' }, mapSubtitle: { color: '#5a6270', fontSize: 11, marginTop: 3 }, mapFootnote: { color: '#5a6270', fontSize: 11, lineHeight: 16, borderTopWidth: 1, borderTopColor: '#e7ebf1', paddingTop: 9 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 }, sectionTitle: { color: '#12151c', fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 9 }, muted: { color: '#8a929e', fontSize: 12 }, loader: { paddingVertical: 20 }, cityRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9, marginBottom: 7 }, cityIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#eaf0ff' }, cityName: { flex: 1, color: '#12151c', fontSize: 14, fontWeight: '600' }, cityCount: { color: '#5a6270', fontSize: 12 }, listingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9, padding: 11, marginBottom: 7 }, listingIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#eaf0ff' }, listingCopy: { flex: 1, minWidth: 0 }, listingTitle: { color: '#12151c', fontSize: 13, fontWeight: '600' }, listingPlace: { color: '#8a929e', fontSize: 11, marginTop: 3 }, approximateChip: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#f0f3f8', borderRadius: 7 }, approximateText: { color: '#657080', fontSize: 10, fontWeight: '600' }, empty: { color: '#5a6270', textAlign: 'center', paddingVertical: 18 }, error: { color: '#b42318', paddingVertical: 14 },
});
