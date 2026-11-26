import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, ArrowRight, Camera, ImagePlus, RotateCcw, RotateCw, Star, Trash2 } from 'lucide-react-native';
import { mediaUrl } from '@/lib/config';
import { Badge, Button, Text, confirm, radius, space, useTheme } from '@/ui';
import { MAX_PHOTOS, type PhotoItem } from './draft';

type Props = {
  photos: PhotoItem[];
  onAdd: (source: 'camera' | 'library') => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  onRotate?: (key: string) => void;
  onMove: (key: string, delta: -1 | 1) => void;
  onCover: (key: string) => void;
  /** Show photo `index` full screen. */
  onOpen: (index: number) => void;
  required: boolean;
};

export function PhotoStep({ photos, onAdd, onRemove, onRetry, onRotate, onMove, onCover, onOpen, required }: Props) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const coverWidth = width - space.lg * 2;
  const size = Math.floor((coverWidth - space.sm * 2) / 3);
  const left = MAX_PHOTOS - photos.length;
  const failed = photos.map((p, i) => ({ p, i })).filter(({ p }) => p.status === 'error');
  const coverPhoto = photos[0];
  const restPhotos = photos.slice(1);

  const remove = async (p: PhotoItem, i: number) => {
    // A finished photo is work; ask first. A failed or uploading one can go at once.
    if (p.status === 'done') {
      const ok = await confirm({ title: `${i + 1}. fotoğraf silinsin mi?`, confirmText: 'Sil', destructive: true });
      if (!ok) return;
    }
    onRemove(p.key);
  };

  const renderTile = (p: PhotoItem, i: number, isCover: boolean) => {
    const uri = (p.status === 'done' ? mediaUrl(p.url, isCover ? 800 : 480) : undefined) ?? p.localUri ?? mediaUrl(p.url, isCover ? 800 : 480);
    return (
      <View
        key={p.key}
        style={[
          styles.tile,
          isCover ? { width: coverWidth, height: Math.round(coverWidth * 0.62) } : { width: size, height: size },
          { backgroundColor: c.elevated },
        ]}
      >
        <Pressable accessibilityRole="imagebutton" accessibilityLabel={`${i + 1}. fotoğrafı büyüt`} onPress={() => onOpen(i)} style={StyleSheet.absoluteFill}>
          {uri ? <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </Pressable>
        {isCover ? <Badge label="KAPAK FOTOĞRAFI" tone="primary" style={styles.cover} /> : null}
        {p.status === 'uploading' ? (
          <View style={[styles.overlay, { backgroundColor: c.overlay }]}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : p.status === 'error' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}. fotoğraf yüklenemedi: ${p.error ?? ''}. Tekrar dene`}
            onPress={() => onRetry(p.key)}
            style={[styles.overlay, { backgroundColor: 'rgba(180,35,24,0.7)' }]}
          >
            <RotateCcw size={20} color="#fff" />
            <Text variant="small" style={styles.white}>
              Tekrar dene
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.deleteCorner}>
          <Tool label={`${i + 1}. fotoğrafı sil`} onPress={() => void remove(p, i)}>
            <Trash2 size={15} color="#fff" />
          </Tool>
        </View>
        <View style={styles.tools}>
          {i > 0 ? (
            <Tool label="Sola taşı" onPress={() => onMove(p.key, -1)}>
              <ArrowLeft size={14} color="#fff" />
            </Tool>
          ) : null}
          {i > 0 && p.status === 'done' ? (
            <Tool label="Kapak yap" onPress={() => onCover(p.key)}>
              <Star size={14} color="#fff" />
            </Tool>
          ) : null}
          {onRotate && p.source && p.status === 'done' ? (
            <Tool label="Döndür" onPress={() => onRotate(p.key)}>
              <RotateCw size={14} color="#fff" />
            </Tool>
          ) : null}
          {i < photos.length - 1 ? (
            <Tool label="Sağa taşı" onPress={() => onMove(p.key, 1)}>
              <ArrowRight size={14} color="#fff" />
            </Tool>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <Text tone="muted">
        {required ? 'Bu kategoride en az 1 fotoğraf zorunlu. ' : ''}En fazla {MAX_PHOTOS} fotoğraf ekleyebilirsiniz. İlk fotoğraf kapak olur.
      </Text>
      {photos.length === 0 ? (
        <View style={[styles.emptyBox, { borderColor: c.borderStrong, backgroundColor: c.elevated }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: c.primarySoft }]}>
            <ImagePlus size={30} color={c.primary} />
          </View>
          <Text variant="subheading" center>
            Fotoğraflarınızı ekleyin
          </Text>
          <Text variant="caption" tone="muted" center style={styles.emptySub}>
            Kameranızla çekin veya galeriden birden fazla fotoğraf seçin.
          </Text>
          <View style={styles.emptyActions}>
            <Button title="Galeriden seç" icon={ImagePlus} onPress={() => onAdd('library')} />
            <Button title="Fotoğraf çek" icon={Camera} variant="outline" onPress={() => onAdd('camera')} />
          </View>
          <Text variant="small" tone="subtle" center>
            JPEG, PNG, WebP veya HEIC · en fazla {MAX_PHOTOS} fotoğraf
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.actions}>
            <Button title="Galeriden seç" icon={ImagePlus} variant="soft" disabled={left < 1} onPress={() => onAdd('library')} style={styles.flex} />
            <Button title="Fotoğraf çek" icon={Camera} variant="outline" disabled={left < 1} onPress={() => onAdd('camera')} style={styles.flex} />
          </View>

          {coverPhoto ? renderTile(coverPhoto, 0, true) : null}

          {restPhotos.length > 0 || left > 0 ? (
            <View style={styles.grid}>
              {restPhotos.map((p, idx) => renderTile(p, idx + 1, false))}
              {left > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fotoğraf ekle"
                  onPress={() => onAdd('library')}
                  style={[styles.tile, styles.add, { width: size, height: size, borderColor: c.borderStrong }]}
                >
                  <ImagePlus size={24} color={c.subtle} />
                  <Text variant="small" tone="subtle">
                    {photos.length}/{MAX_PHOTOS}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      {failed.length ? (
        <View style={[styles.errors, { backgroundColor: c.dangerSoft }]}>
          {failed.map(({ p, i }) => (
            <Text key={p.key} variant="caption" tone="danger">
              {i + 1}. fotoğraf: {p.error ?? 'Yüklenemedi.'} Üstüne dokunarak tekrar deneyin ya da silin.
            </Text>
          ))}
        </View>
      ) : null}

      <View style={[styles.tips, { backgroundColor: c.elevated }]}>
        <Text variant="label">İpuçları</Text>
        <Text variant="caption" tone="muted">
          • Gün ışığında, ürünün tamamını gösteren fotoğraflar çekin.{'\n'}• Seçtiğiniz fotoğrafları eklemeden önce büyük görüp döndürebilirsiniz.{'\n'}• En net fotoğrafı kapak yapın; ilk izlenim önemlidir.{'\n'}•
          Fotoğraflar oranı korunarak küçültülür ve filigran eklenir.
        </Text>
      </View>
    </View>
  );
}

function Tool({ children, label, onPress }: { children: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={styles.tool}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: space.lg },
  emptyBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.xxl,
    alignItems: 'center',
    gap: space.sm,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  emptySub: { maxWidth: 280 },
  emptyActions: { width: '100%', gap: space.sm, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { borderRadius: radius.md, overflow: 'hidden' },
  cover: { position: 'absolute', top: 6, left: 6 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 4 },
  white: { color: '#fff' },
  tools: { position: 'absolute', left: 4, right: 4, bottom: 4, flexDirection: 'row', gap: 4 },
  deleteCorner: { position: 'absolute', top: 4, right: 4 },
  tool: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(13,17,23,0.6)', alignItems: 'center', justifyContent: 'center' },
  errors: { padding: space.md, borderRadius: radius.md, gap: space.xs },
  add: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tips: { padding: space.md, borderRadius: radius.md, gap: space.xs },
});
