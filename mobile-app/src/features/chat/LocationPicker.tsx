import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { LocateFixed, MapPin, Navigation, Search, Send, X } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { geo, type GeoPlace } from '@/api/endpoints';
import { MapCanvas, type MapCanvasHandle } from '@/features/map/MapCanvas';
import type { MapEvent } from '@/features/map/mapHtml';
import { TURKEY_CENTER } from '@/features/map/tiles';
import { Button, IconButton, Text, font, hairline, radius, shadow, space, toast, useTheme } from '@/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSend: (label: string, lat: number, lng: number) => Promise<void>;
};

/** Zoomed out further than this, the pin is not a meaningful place. */
const MIN_PLACE_ZOOM = 12;

/**
 * WhatsApp-style meeting-point picker: the map pans under a fixed pin, places
 * can be searched, and "send my current location" is one tap. The address
 * under the pin is looked up when the map stops.
 */
export function LocationPicker({ visible, onClose, onSend }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      {visible ? <PickerBody onClose={onClose} onSend={onSend} /> : null}
    </Modal>
  );
}

function PickerBody({ onClose, onSend }: Omit<Props, 'visible'>) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const map = useRef<MapCanvasHandle>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const [label, setLabel] = useState('');
  const [resolving, setResolving] = useState(false);
  const [mine, setMine] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [locating, setLocating] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<'pin' | 'mine' | null>(null);
  const lookup = useRef(0);
  const ready = useRef(false);

  const locate = async (fly: boolean) => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (fly) toast.info('Konum izni verilmedi. Haritayı kaydırarak bir yer seçebilirsiniz.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
      setMine(here);
      map.current?.flyTo(here.lat, here.lng, 17);
    } catch {
      if (fly) toast.error('Konumunuz alınamadı.');
    } finally {
      setLocating(false);
    }
  };

  const onEvent = (event: MapEvent) => {
    if (event.type === 'ready') {
      if (!ready.current) {
        ready.current = true;
        void locate(false);
      }
    } else if (event.type === 'movestart') {
      setMoving(true);
    } else {
      setMoving(false);
      setCenter({ lat: event.lat, lng: event.lng, zoom: event.zoom });
    }
  };

  // Address under the pin once the map settles.
  useEffect(() => {
    if (!center || center.zoom < MIN_PLACE_ZOOM) return;
    const id = ++lookup.current;
    const t = setTimeout(() => {
      setResolving(true);
      geo
        .reverse(center.lat, center.lng)
        .then((text) => id === lookup.current && setLabel(text || 'Seçilen konum'))
        .catch(() => id === lookup.current && setLabel('Seçilen konum'))
        .finally(() => id === lookup.current && setResolving(false));
    }, 450);
    return () => clearTimeout(t);
  }, [center]);

  // Place search, debounced.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => {
      setSearching(true);
      geo
        .search(term, center ?? undefined)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 450);
    return () => clearTimeout(t);
    // Searching near the current view, but not re-running on every pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pick = (p: GeoPlace) => {
    setQ('');
    setResults([]);
    lookup.current++;
    setLabel(p.label);
    map.current?.flyTo(p.lat, p.lng, 17);
  };

  const send = async (kind: 'pin' | 'mine') => {
    const point = kind === 'mine' ? mine : center;
    if (!point) return;
    setBusy(kind);
    try {
      let text = kind === 'pin' ? label : '';
      if (!text) text = (await geo.reverse(point.lat, point.lng).catch(() => '')) || 'Bulunduğum konum';
      await onSend(text.slice(0, 120), point.lat, point.lng);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const zoomedIn = (center?.zoom ?? 0) >= MIN_PLACE_ZOOM;
  const canSendPin = Boolean(center && zoomedIn && !moving && !resolving && label);
  const showResults = q.trim().length >= 2;

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.xs, backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.titleRow}>
          <IconButton icon={X} label="Kapat" onPress={onClose} />
          <View style={styles.flex}>
            <Text variant="subheading">Konum gönder</Text>
            <Text variant="small" tone="muted">
              Haritayı kaydırarak buluşma noktasını seçin
            </Text>
          </View>
        </View>
        <View style={[styles.search, { backgroundColor: c.elevated }]}>
          <Search size={18} color={c.subtle} />
          <TextInput
            value={q}
            onChangeText={(t) => {
              setQ(t);
              if (t.trim().length < 2) setResults([]);
            }}
            placeholder="Yer, cadde veya semt ara"
            placeholderTextColor={c.subtle}
            returnKeyType="search"
            style={[styles.input, { color: c.fg }]}
            accessibilityLabel="Yer ara"
          />
          {searching ? <ActivityIndicator size="small" color={c.primary} /> : null}
        </View>
      </View>

      <View style={styles.flex}>
        <MapCanvas ref={map} initial={TURKEY_CENTER} dark={dark} onEvent={onEvent} />
        {/* Fixed pin: the map moves underneath it. */}
        <View pointerEvents="none" style={styles.pinWrap}>
          <View style={{ transform: [{ translateY: moving ? -10 : 0 }] }}>
            <MapPin size={44} color="#ffffff" fill="#e5484d" strokeWidth={1.4} />
          </View>
          <View style={styles.pinShadow} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Konumuma git"
          onPress={() => void locate(true)}
          style={[styles.myBtn, { backgroundColor: c.surface, borderColor: c.border }, shadow(2)]}
        >
          {locating ? <ActivityIndicator color={c.primary} /> : <LocateFixed size={22} color={c.primary} />}
        </Pressable>

        {showResults ? (
          <View style={[styles.results, { backgroundColor: c.surface, borderColor: c.border }, shadow(2)]}>
            <FlatList
              data={results}
              keyExtractor={(r) => `${r.lat},${r.lng}`}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text tone="muted" center style={styles.noResult}>
                  {searching ? 'Aranıyor…' : 'Sonuç yok'}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable onPress={() => pick(item)} style={({ pressed }) => [styles.result, { borderBottomColor: c.border }, pressed && { backgroundColor: c.elevated }]}>
                  <MapPin size={18} color={c.primary} />
                  <Text style={styles.flex} numberOfLines={2}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        ) : null}
      </View>

      <View style={[styles.bottom, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: insets.bottom + space.md }]}>
        {mine ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={() => void send('mine')}
            style={({ pressed }) => [styles.mineRow, pressed && { backgroundColor: c.elevated }]}
          >
            <View style={[styles.mineIcon, { backgroundColor: c.primary }]}>
              {busy === 'mine' ? <ActivityIndicator color="#fff" size="small" /> : <Navigation size={18} color="#fff" />}
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong" tone="primary">
                Mevcut konumumu gönder
              </Text>
              <Text variant="small" tone="muted">
                {mine.accuracy ? `${Math.round(mine.accuracy)} metre hassasiyetle` : 'Bulunduğunuz yer'}
              </Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.pinRow}>
          <View style={[styles.mineIcon, { backgroundColor: c.primarySoft }]}>
            <MapPin size={18} color={c.primary} />
          </View>
          <View style={styles.flex}>
            <Text variant="small" tone="muted">
              {zoomedIn ? 'İğnenin olduğu yer' : 'Bir yer seçmek için yakınlaştırın'}
            </Text>
            {zoomedIn ? (
              <TextInput
                value={resolving || moving ? 'Adres bulunuyor…' : label}
                onChangeText={(t) => setLabel(t.slice(0, 120))}
                editable={!resolving && !moving}
                style={[styles.labelInput, { color: resolving || moving ? c.muted : c.fg }]}
                accessibilityLabel="Yer adı"
              />
            ) : null}
          </View>
        </View>
        <Button title="Bu konumu gönder" icon={Send} loading={busy === 'pin'} disabled={!canSendPin || busy !== null} onPress={() => void send('pin')} />
        <Text variant="small" tone="subtle" center>
          Kalabalık ve herkese açık bir yer seçin; ev adresinizi paylaşmayın.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { borderBottomWidth: hairline, paddingBottom: space.sm, gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 42, borderRadius: radius.md, paddingHorizontal: space.md, marginHorizontal: space.md },
  input: { flex: 1, fontSize: font.md, height: 42 },
  pinWrap: { position: 'absolute', left: '50%', top: '50%', marginLeft: -22, marginTop: -44, alignItems: 'center' },
  pinShadow: { width: 8, height: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: -2 },
  myBtn: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  results: { position: 'absolute', top: space.sm, left: space.md, right: space.md, maxHeight: 300, borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.md, borderBottomWidth: hairline },
  noResult: { padding: space.lg },
  bottom: { borderTopWidth: hairline, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs, borderRadius: radius.md },
  mineIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  labelInput: { fontSize: font.md, fontWeight: '600', paddingVertical: 2 },
});
