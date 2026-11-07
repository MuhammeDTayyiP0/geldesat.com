import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Plus, RotateCw, SendHorizontal, Star, Trash2, X } from 'lucide-react-native';
import { pickPhotos, rotatePhoto, type PickedPhoto } from '@/lib/photos';
import { Badge, Button, IconButton, Text, font, radius, space, toast, useTheme } from '@/ui';

type Item = { key: string; photo: PickedPhoto };

export type PhotoReviewProps = {
  /** The photos just picked; null keeps the screen closed. */
  photos: PickedPhoto[] | null;
  /** listing: "add to listing" with a cover; chat: caption and send. */
  mode: 'listing' | 'chat';
  /** Most photos the review may end with (free slots in the listing, chat send limit). */
  max: number;
  /** Listing: photos already in the listing. With none, the first photo here becomes the cover. */
  existing?: number;
  onCancel: () => void;
  onConfirm: (photos: PickedPhoto[], caption: string) => void;
};

/**
 * Full-screen check before photos go anywhere, like the big apps: see each
 * photo large, swipe between them, turn, remove, pick the cover, add more,
 * write a caption. Nothing is uploaded or sent until the person confirms.
 */
export function PhotoReview(props: PhotoReviewProps) {
  return (
    <Modal
      visible={props.photos !== null}
      animationType="slide"
      onRequestClose={props.onCancel}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait']}
    >
      {props.photos ? <ReviewBody {...props} photos={props.photos} /> : null}
    </Modal>
  );
}

let nextKey = 0;
const toItems = (photos: PickedPhoto[]): Item[] => photos.map((photo) => ({ key: `r${nextKey++}`, photo }));

function ReviewBody({ photos, mode, max, existing = 0, onCancel, onConfirm }: PhotoReviewProps & { photos: PickedPhoto[] }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(() => toItems(photos.slice(0, max)));
  const [index, setIndex] = useState(0);
  const [turning, setTurning] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const list = useRef<FlatList<Item>>(null);

  const current = items[Math.min(index, items.length - 1)];
  const coverHere = mode === 'listing' && existing === 0;

  // Keep the big photo on the selected thumbnail after taps, removals and reorders.
  useEffect(() => {
    if (items.length) list.current?.scrollToOffset({ offset: Math.min(index, items.length - 1) * width, animated: true });
  }, [index, items.length, width]);

  const select = (i: number) => setIndex(Math.max(0, Math.min(i, items.length - 1)));

  const remove = () => {
    if (!current) return;
    if (items.length === 1) {
      onCancel();
      return;
    }
    setItems((list) => list.filter((x) => x.key !== current.key));
    setIndex((i) => Math.min(i, items.length - 2));
  };

  const turn = async () => {
    if (!current || turning) return;
    setTurning(current.key);
    try {
      const turned = await rotatePhoto(current.photo);
      setItems((list) => list.map((x) => (x.key === current.key ? { ...x, photo: turned } : x)));
    } catch {
      toast.error('Fotoğraf döndürülemedi.');
    } finally {
      setTurning(null);
    }
  };

  const makeCover = () => {
    if (!current) return;
    setItems((list) => [current, ...list.filter((x) => x.key !== current.key)]);
    setIndex(0);
  };

  const addMore = async () => {
    const picked = await pickPhotos('library', max - items.length);
    if (!picked.length) return;
    setItems((list) => [...list, ...toItems(picked)].slice(0, max));
    setIndex(items.length);
  };

  const confirm = () => {
    if (turning || !items.length) return;
    onConfirm(
      items.map((x) => x.photo),
      caption.trim(),
    );
  };

  const thumb = 56;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <FlatList
          ref={list}
          data={items}
          horizontal
          pagingEnabled
          style={styles.flex}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(x) => x.key}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => select(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <View style={[styles.page, { width }]}>
              <Image source={{ uri: item.photo.uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} />
              {turning === item.key ? (
                <View style={styles.busy}>
                  <ActivityIndicator color="#fff" size="large" />
                </View>
              ) : null}
              {coverHere && i === 0 ? <Badge label="KAPAK FOTOĞRAFI" tone="primary" style={[styles.coverBadge, { top: insets.top + 64 }]} /> : null}
            </View>
          )}
        />

        <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
          <IconButton icon={X} label="Vazgeç" tone="onImage" onPress={onCancel} />
          <Text variant="label" style={styles.white}>
            {items.length > 1 ? `${index + 1} / ${items.length}` : mode === 'chat' ? 'Fotoğraf gönder' : 'Fotoğraf ekle'}
          </Text>
          <View style={styles.topActions}>
            <IconButton icon={RotateCw} label="Döndür" tone="onImage" disabled={!!turning} onPress={() => void turn()} />
            <IconButton icon={Trash2} label="Kaldır" tone="onImage" onPress={remove} />
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
          {coverHere && index > 0 ? (
            <Pressable accessibilityRole="button" onPress={makeCover} style={styles.coverButton}>
              <Star size={14} color="#fff" />
              <Text variant="small" style={styles.white}>
                Kapak yap
              </Text>
            </Pressable>
          ) : null}

          {items.length > 1 || items.length < max ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {items.map((x, i) => (
                <Pressable
                  key={x.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}. fotoğraf`}
                  onPress={() => select(i)}
                  style={[styles.thumb, { width: thumb, height: thumb, borderColor: i === index ? c.primary : 'transparent' }]}
                >
                  <Image source={{ uri: x.photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {coverHere && i === 0 ? (
                    <View style={[styles.thumbCover, { backgroundColor: c.primary }]}>
                      <Star size={9} color="#fff" fill="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              ))}
              {items.length < max ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fotoğraf ekle"
                  onPress={() => void addMore()}
                  style={[styles.thumb, styles.addThumb, { width: thumb, height: thumb }]}
                >
                  <Plus size={22} color="#fff" />
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}

          {mode === 'chat' ? (
            <View style={styles.captionRow}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Açıklama ekle…"
                placeholderTextColor="rgba(255,255,255,0.55)"
                maxLength={2000}
                multiline
                style={styles.caption}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={items.length > 1 ? `${items.length} fotoğrafı gönder` : 'Gönder'}
                disabled={!!turning}
                onPress={confirm}
                style={[styles.send, { backgroundColor: c.primary, opacity: turning ? 0.5 : 1 }]}
              >
                <SendHorizontal size={20} color={c.onPrimary} />
                {items.length > 1 ? (
                  <View style={[styles.sendCount, { borderColor: c.primary }]}>
                    <Text variant="small" style={styles.sendCountText}>
                      {items.length}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          ) : (
            <Button
              title={items.length > 1 ? `${items.length} fotoğrafı ekle` : 'Fotoğrafı ekle'}
              disabled={!!turning}
              onPress={confirm}
              style={styles.addButton}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: '#000' },
  white: { color: '#fff' },
  page: { flex: 1 },
  busy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  coverBadge: { position: 'absolute', alignSelf: 'center' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topActions: { flexDirection: 'row', gap: space.sm },
  bottom: { gap: space.md, paddingTop: space.md, paddingHorizontal: space.lg, backgroundColor: 'rgba(0,0,0,0.6)' },
  coverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  strip: { gap: space.sm, paddingVertical: 2 },
  thumb: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 2 },
  thumbCover: { position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addThumb: { borderColor: 'rgba(255,255,255,0.4)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  captionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  caption: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: font.md,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sendCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCountText: { color: '#000', fontWeight: '700' },
  addButton: { alignSelf: 'stretch' },
});
