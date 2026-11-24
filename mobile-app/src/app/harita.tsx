import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ChevronRight, ImageOff, MapPin, Search, X } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { catalog } from '@/api/endpoints';
import { keys, useRoots } from '@/api/queries';
import type { Listing } from '@/api/types';
import { TURKEY_CITIES } from '@/data/locations';
import { MapCanvas } from '@/features/map/MapCanvas';
import type { MapBounds, MapEvent, MapMarker } from '@/features/map/mapHtml';
import { TURKEY_CENTER } from '@/features/map/tiles';
import { mediaUrl } from '@/lib/config';
import { useFlag } from '@/lib/flags';
import { formatNumber, formatPrice, locationLabel } from '@/lib/format';
import { Button, Card, Chip, Header, IconButton, Input, Text, hairline, radius, space, useTheme } from '@/ui';

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Adana: { lat: 37.0, lng: 35.3213 },
  Adıyaman: { lat: 37.7636, lng: 38.2773 },
  Afyonkarahisar: { lat: 38.7507, lng: 30.5567 },
  Ağrı: { lat: 39.7191, lng: 43.0503 },
  Amasya: { lat: 40.6499, lng: 35.8353 },
  Ankara: { lat: 39.9334, lng: 32.8597 },
  Antalya: { lat: 36.8969, lng: 30.7133 },
  Artvin: { lat: 41.1828, lng: 41.8183 },
  Aydın: { lat: 37.838, lng: 27.8456 },
  Balıkesir: { lat: 39.6484, lng: 27.8826 },
  Bilecik: { lat: 40.1501, lng: 29.9831 },
  Bingöl: { lat: 38.8855, lng: 40.4966 },
  Bitlis: { lat: 38.4006, lng: 42.1095 },
  Bolu: { lat: 40.7392, lng: 31.6089 },
  Burdur: { lat: 37.7183, lng: 30.282 },
  Bursa: { lat: 40.1826, lng: 29.0665 },
  Çanakkale: { lat: 40.1553, lng: 26.4142 },
  Çankırı: { lat: 40.6, lng: 33.6167 },
  Çorum: { lat: 40.5489, lng: 34.9533 },
  Denizli: { lat: 37.7765, lng: 29.0864 },
  Diyarbakır: { lat: 37.9144, lng: 40.2306 },
  Edirne: { lat: 41.6771, lng: 26.5557 },
  Elazığ: { lat: 38.6748, lng: 39.2225 },
  Erzincan: { lat: 39.75, lng: 39.5 },
  Erzurum: { lat: 39.9055, lng: 41.2658 },
  Eskişehir: { lat: 39.7767, lng: 30.5206 },
  Gaziantep: { lat: 37.0662, lng: 37.3833 },
  Giresun: { lat: 40.9128, lng: 38.3895 },
  Gümüşhane: { lat: 40.46, lng: 39.4814 },
  Hakkari: { lat: 37.5833, lng: 43.7333 },
  Hatay: { lat: 36.4018, lng: 36.3498 },
  Isparta: { lat: 37.7648, lng: 30.5566 },
  Mersin: { lat: 36.8121, lng: 34.6415 },
  İstanbul: { lat: 41.0082, lng: 28.9784 },
  İzmir: { lat: 38.4192, lng: 27.1287 },
  Kars: { lat: 40.6019, lng: 43.0975 },
  Kastamonu: { lat: 41.3887, lng: 33.7827 },
  Kayseri: { lat: 38.7312, lng: 35.4787 },
  Kırklareli: { lat: 41.735, lng: 27.2256 },
  Kırşehir: { lat: 39.1461, lng: 34.1595 },
  Kocaeli: { lat: 40.7654, lng: 29.9408 },
  Konya: { lat: 37.8746, lng: 32.4932 },
  Kütahya: { lat: 39.4192, lng: 29.9857 },
  Malatya: { lat: 38.3554, lng: 38.3335 },
  Manisa: { lat: 38.614, lng: 27.4296 },
  Kahramanmaraş: { lat: 37.5858, lng: 36.9371 },
  Mardin: { lat: 37.3129, lng: 40.734 },
  Muğla: { lat: 37.2153, lng: 28.3636 },
  Muş: { lat: 38.7432, lng: 41.5065 },
  Nevşehir: { lat: 38.6244, lng: 34.7236 },
  Niğde: { lat: 37.9667, lng: 34.6793 },
  Ordu: { lat: 40.9839, lng: 37.8764 },
  Rize: { lat: 41.0201, lng: 40.5234 },
  Sakarya: { lat: 40.7731, lng: 30.3948 },
  Samsun: { lat: 41.2867, lng: 36.33 },
  Siirt: { lat: 37.9333, lng: 41.95 },
  Sinop: { lat: 42.0267, lng: 35.1551 },
  Sivas: { lat: 39.7477, lng: 37.0179 },
  Tekirdağ: { lat: 40.978, lng: 27.511 },
  Tokat: { lat: 40.3167, lng: 36.55 },
  Trabzon: { lat: 41.0027, lng: 39.7168 },
  Tunceli: { lat: 39.1079, lng: 39.5401 },
  Şanlıurfa: { lat: 37.1591, lng: 38.7969 },
  Uşak: { lat: 38.6823, lng: 29.4082 },
  Van: { lat: 38.4891, lng: 43.4089 },
  Yozgat: { lat: 39.82, lng: 34.8083 },
  Zonguldak: { lat: 41.4564, lng: 31.7987 },
  Aksaray: { lat: 38.3687, lng: 34.036 },
  Bayburt: { lat: 40.2552, lng: 40.2249 },
  Karaman: { lat: 37.1759, lng: 33.2287 },
  Kırıkkale: { lat: 39.8468, lng: 33.5153 },
  Batman: { lat: 37.8812, lng: 41.1351 },
  Şırnak: { lat: 37.5164, lng: 42.4611 },
  Bartın: { lat: 41.6344, lng: 32.3375 },
  Ardahan: { lat: 41.1105, lng: 42.7022 },
  Iğdır: { lat: 39.9167, lng: 44.0333 },
  Yalova: { lat: 40.65, lng: 29.2667 },
  Karabük: { lat: 41.2061, lng: 32.6204 },
  Kilis: { lat: 36.7184, lng: 37.1212 },
  Osmaniye: { lat: 37.0742, lng: 36.2478 },
  Düzce: { lat: 40.8438, lng: 31.1565 },
};

const DEFAULT_BOUNDS: MapBounds = { north: 42.5, south: 35.5, east: 45.0, west: 25.5 };

const PRICE_PRESETS: { key: string; label: string; minPrice?: number; maxPrice?: number }[] = [
  { key: 'all', label: 'Tüm fiyatlar' },
  { key: 'u5k', label: '5.000 ₺ altı', maxPrice: 5000 },
  { key: 'u50k', label: '50.000 ₺ altı', maxPrice: 50000 },
  { key: 'u500k', label: '500.000 ₺ altı', maxPrice: 500000 },
  { key: 'o500k', label: '500.000 ₺ üstü', minPrice: 500000 },
];

export default function MapExploreScreen() {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapSearchOn = useFlag('haritada_ara');
  const roots = useRoots();
  const [filter, setFilter] = useState('');
  const [bounds, setBounds] = useState<MapBounds>(DEFAULT_BOUNDS);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [pricePreset, setPricePreset] = useState('all');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const countsQuery = useQuery({ queryKey: keys.cityCounts, queryFn: catalog.cityCounts, staleTime: 60_000 });

  const priceRange = useMemo(() => PRICE_PRESETS.find((p) => p.key === pricePreset) ?? PRICE_PRESETS[0], [pricePreset]);

  const inBoundsParams = useMemo(
    () => ({
      north: Number(bounds.north.toFixed(4)),
      south: Number(bounds.south.toFixed(4)),
      east: Number(bounds.east.toFixed(4)),
      west: Number(bounds.west.toFixed(4)),
      category: selectedCategory ?? undefined,
      minPrice: priceRange.minPrice,
      maxPrice: priceRange.maxPrice,
      q: mapSearchOn && filter.trim() ? filter.trim() : undefined,
    }),
    [bounds, selectedCategory, priceRange, mapSearchOn, filter],
  );

  const inBoundsQuery = useQuery({
    queryKey: keys.mapListings(inBoundsParams),
    queryFn: () => catalog.inBounds(inBoundsParams),
    enabled: mapSearchOn,
    placeholderData: (prev) => prev,
    staleTime: 20_000,
  });

  const countByCity = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of countsQuery.data ?? []) {
      map.set(row.city, row.n);
    }
    return map;
  }, [countsQuery.data]);

  const markers = useMemo<MapMarker[]>(() => {
    if (mapSearchOn) {
      const list: MapMarker[] = [];
      for (const l of inBoundsQuery.data ?? []) {
        if (l.lat == null || l.lng == null) continue;
        list.push({
          id: l.id,
          lat: l.lat,
          lng: l.lng,
          label: l.title,
          badge: formatPrice(l.price, l.currency),
        });
      }
      return list;
    }
    const list: MapMarker[] = [];
    for (const { city, n } of countsQuery.data ?? []) {
      if (n <= 0) continue;
      const coords = CITY_COORDS[city];
      if (!coords) continue;
      list.push({ id: city, lat: coords.lat, lng: coords.lng, label: `${city}: ${formatNumber(n)} ilan`, badge: formatNumber(n) });
    }
    return list;
  }, [mapSearchOn, inBoundsQuery.data, countsQuery.data]);

  const cities = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase('tr');
    const items = TURKEY_CITIES.map((city) => ({
      id: city.id,
      name: city.name,
      count: countByCity.get(city.name) ?? 0,
    }));
    const filtered = q ? items.filter((city) => city.name.toLocaleLowerCase('tr').includes(q)) : items;
    return filtered.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'tr');
    });
  }, [countByCity, filter]);

  const openCity = (city: string) => router.push({ pathname: '/sonuclar', params: { city } });

  const handleMapEvent = (event: MapEvent) => {
    if (!mapSearchOn) return;
    if ((event.type === 'ready' || event.type === 'moveend') && event.bounds) {
      setBounds(event.bounds);
    }
  };

  const handleMarkerPress = (markerId: string) => {
    if (!mapSearchOn) {
      openCity(markerId);
      return;
    }
    const found = inBoundsQuery.data?.find((l) => l.id === markerId) ?? null;
    setSelectedListing(found);
  };

  const rootCategories = roots.data?.roots ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header
        title="Harita"
        subtitle={
          mapSearchOn
            ? inBoundsQuery.isFetching
              ? 'Bölgedeki ilanlar güncelleniyor…'
              : `Bölgede ${formatNumber(inBoundsQuery.data?.length ?? 0)} ilan`
            : 'İllere göre yayında ilanlar'
        }
      />
      <FlatList
        data={cities}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + space.xxxl }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Input
              icon={Search}
              placeholder={mapSearchOn ? 'Haritada veya il ara…' : 'İl ara…'}
              value={filter}
              onChangeText={setFilter}
              right={filter ? <IconButton icon={X} label="Temizle" size={32} onPress={() => setFilter('')} /> : undefined}
            />
            {mapSearchOn ? (
              <View style={styles.filterRows}>
                {rootCategories.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    <Chip label="Tüm kategoriler" selected={!selectedCategory} onPress={() => setSelectedCategory(null)} />
                    {rootCategories.map((cat) => (
                      <Chip
                        key={cat.id}
                        label={cat.name}
                        selected={selectedCategory === cat.slug}
                        onPress={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
                      />
                    ))}
                  </ScrollView>
                ) : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {PRICE_PRESETS.map((preset) => (
                    <Chip
                      key={preset.key}
                      label={preset.label}
                      selected={pricePreset === preset.key}
                      onPress={() => setPricePreset(preset.key)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <View style={[styles.mapWrap, { borderColor: c.border, backgroundColor: c.surface }]}>
              <MapCanvas
                initial={{ lat: TURKEY_CENTER.lat, lng: TURKEY_CENTER.lng, zoom: 5 }}
                dark={dark}
                markers={markers}
                onEvent={handleMapEvent}
                onMarkerPress={handleMarkerPress}
              />
            </View>
            {mapSearchOn && selectedListing ? (
              <Card padded={false} style={styles.pinPreview}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/ilan/[id]', params: { id: selectedListing.id } })}
                  style={styles.pinBody}
                >
                  <View style={[styles.pinThumb, { backgroundColor: c.elevated }]}>
                    {mediaUrl(selectedListing.images[0], 240) ? (
                      <Image source={mediaUrl(selectedListing.images[0], 240)} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <ImageOff size={20} color={c.subtle} />
                    )}
                  </View>
                  <View style={styles.pinInfo}>
                    <Text variant="bodyStrong" tone="primary" numberOfLines={1}>
                      {formatPrice(selectedListing.price, selectedListing.currency)}
                    </Text>
                    <Text variant="label" numberOfLines={2}>
                      {selectedListing.title}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {locationLabel(selectedListing.city, selectedListing.district) || selectedListing.category_name || ''}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={c.subtle} />
                </Pressable>
                <View style={styles.pinClose}>
                  <IconButton icon={X} label="Önizlemeyi kapat" size={28} onPress={() => setSelectedListing(null)} />
                </View>
              </Card>
            ) : null}
            {mapSearchOn && inBoundsQuery.isError && !inBoundsQuery.data ? (
              <Card style={styles.errorCard}>
                <Text variant="caption" tone="muted" style={styles.flex}>
                  {errorMessage(inBoundsQuery.error, 'Bölgedeki ilanlar yüklenemedi.')}
                </Text>
                <Button title="Tekrar dene" size="sm" variant="outline" onPress={() => void inBoundsQuery.refetch()} />
              </Card>
            ) : null}
            {countsQuery.isError && !countsQuery.data ? (
              <Card style={styles.errorCard}>
                <Text variant="caption" tone="muted" style={styles.flex}>
                  {errorMessage(countsQuery.error, 'İl sayıları yüklenemedi.')}
                </Text>
                <Button title="Tekrar dene" size="sm" variant="outline" onPress={() => void countsQuery.refetch()} />
              </Card>
            ) : null}
            <Text variant="subheading">İllere göre</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => openCity(item.name)}
            style={({ pressed }) => [
              styles.cityCard,
              {
                backgroundColor: pressed ? c.elevated : c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <MapPin size={15} color={item.count > 0 ? c.primary : c.subtle} />
            <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
              {item.name}
            </Text>
            {countsQuery.data ? (
              <Text variant="caption" tone={item.count > 0 ? 'primary' : 'subtle'}>
                {formatNumber(item.count)}
              </Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text tone="muted" center style={styles.empty}>
            Eşleşen il bulunamadı.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.lg, gap: space.sm },
  header: { gap: space.md, marginBottom: space.xs },
  mapWrap: { height: 280, borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  filterRows: { gap: space.xs },
  chips: { gap: space.xs },
  pinPreview: { overflow: 'hidden' },
  pinBody: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingRight: 40 },
  pinThumb: { width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pinInfo: { flex: 1, gap: 2 },
  pinClose: { position: 'absolute', top: space.xs, right: space.xs },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  row: { gap: space.sm },
  cityCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: hairline,
  },
  empty: { paddingVertical: space.xl },
});
