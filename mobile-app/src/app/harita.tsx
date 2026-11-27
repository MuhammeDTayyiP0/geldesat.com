import { useEffect, useMemo, useState } from 'react';
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
import { CITY_COORDS } from '@/features/map/cityCoords';
import { MapCanvas } from '@/features/map/MapCanvas';
import type { MapBounds, MapEvent, MapMarker } from '@/features/map/mapHtml';
import { TURKEY_CENTER } from '@/features/map/tiles';
import { mediaUrl } from '@/lib/config';
import { useFlag } from '@/lib/flags';
import { formatNumber, formatPrice, locationLabel, maskThousands, parseMasked } from '@/lib/format';
import { Button, Card, Chip, Header, IconButton, Input, Text, hairline, radius, space, useTheme } from '@/ui';

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
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const countsQuery = useQuery({ queryKey: keys.cityCounts, queryFn: catalog.cityCounts, staleTime: 60_000 });

  const minPriceVal = useMemo(() => parseMasked(minPriceInput), [minPriceInput]);
  const maxPriceVal = useMemo(() => parseMasked(maxPriceInput), [maxPriceInput]);
  const hasActiveFilter = Boolean(filter.trim() || selectedCategory || pricePreset !== 'all' || minPriceInput || maxPriceInput);

  const inBoundsParams = useMemo(
    () => ({
      north: Number(bounds.north.toFixed(4)),
      south: Number(bounds.south.toFixed(4)),
      east: Number(bounds.east.toFixed(4)),
      west: Number(bounds.west.toFixed(4)),
      category: selectedCategory ?? undefined,
      minPrice: minPriceVal,
      maxPrice: maxPriceVal && maxPriceVal > 0 ? maxPriceVal : undefined,
      q: mapSearchOn && filter.trim() ? filter.trim() : undefined,
    }),
    [bounds, selectedCategory, minPriceVal, maxPriceVal, mapSearchOn, filter],
  );

  const [debouncedParams, setDebouncedParams] = useState(inBoundsParams);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedParams(inBoundsParams), 250);
    return () => clearTimeout(timer);
  }, [inBoundsParams]);

  const inBoundsQuery = useQuery({
    queryKey: keys.mapListings(debouncedParams),
    queryFn: () => catalog.inBounds(debouncedParams),
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
        const coords =
          l.lat != null && l.lng != null
            ? { lat: l.lat, lng: l.lng }
            : l.city
              ? CITY_COORDS[l.city]
              : undefined;
        if (!coords) continue;
        list.push({
          id: l.id,
          lat: coords.lat,
          lng: coords.lng,
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

  const selectPreset = (preset: { key: string; minPrice?: number; maxPrice?: number }) => {
    setPricePreset(preset.key);
    setMinPriceInput(preset.minPrice ? maskThousands(String(preset.minPrice)) : '');
    setMaxPriceInput(preset.maxPrice ? maskThousands(String(preset.maxPrice)) : '');
  };

  const clearFilters = () => {
    setFilter('');
    setSelectedCategory(null);
    setPricePreset('all');
    setMinPriceInput('');
    setMaxPriceInput('');
  };

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
                      onPress={() => selectPreset(preset)}
                    />
                  ))}
                </ScrollView>
                <View style={styles.priceInputs}>
                  <View style={styles.flex}>
                    <Input
                      placeholder="Min TL"
                      keyboardType="number-pad"
                      value={minPriceInput}
                      onChangeText={(txt) => {
                        const formatted = maskThousands(txt);
                        setMinPriceInput(formatted);
                        setPricePreset(formatted || maxPriceInput ? 'custom' : 'all');
                      }}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Input
                      placeholder="Max TL"
                      keyboardType="number-pad"
                      value={maxPriceInput}
                      onChangeText={(txt) => {
                        const formatted = maskThousands(txt);
                        setMaxPriceInput(formatted);
                        setPricePreset(minPriceInput || formatted ? 'custom' : 'all');
                      }}
                    />
                  </View>
                  {hasActiveFilter ? (
                    <Button title="Temizle" size="sm" variant="outline" onPress={clearFilters} />
                  ) : null}
                </View>
              </View>
            ) : null}
            <View style={[styles.mapWrap, { borderColor: c.border, backgroundColor: c.surface }]}>
              <MapCanvas
                initial={{ lat: TURKEY_CENTER.lat, lng: TURKEY_CENTER.lng, zoom: 5 }}
                dark={dark}
                markers={markers}
                cluster={mapSearchOn}
                selectedId={selectedListing?.id ?? null}
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
  priceInputs: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
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
