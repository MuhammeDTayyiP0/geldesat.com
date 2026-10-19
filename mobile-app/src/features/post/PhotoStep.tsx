import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, ArrowRight, Camera, ImagePlus, RotateCcw, Star, Trash2 } from 'lucide-react-native';
import { mediaUrl } from '@/lib/config';
import { Badge, Button, Text, radius, space, useTheme } from '@/ui';
import { MAX_PHOTOS, type PhotoItem } from './draft';

type Props = {
  photos: PhotoItem[];
  onAdd: (source: 'camera' | 'library') => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  onMove: (key: string, delta: -1 | 1) => void;
  onCover: (key: string) => void;
  required: boolean;
};

export function PhotoStep({ photos, onAdd, onRemove, onRetry, onMove, onCover, required }: Props) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const size = Math.floor((width - space.lg * 2 - space.sm * 2) / 3);
  const left = MAX_PHOTOS - photos.length;

  return (
    <View style={styles.wrap}>
      <Text tone="muted">
        {required ? 'Bu kategoride en az 1 fotoğraf zorunlu. ' : ''}En fazla {MAX_PHOTOS} fotoğraf ekleyebilirsiniz. İlk fotoğraf kapak olur.
      </Text>
      <View style={styles.actions}>
        <Button title="Galeriden seç" icon={ImagePlus} variant="soft" disabled={left < 1} onPress={() => onAdd('library')} style={styles.flex} />
        <Button title="Fotoğraf çek" icon={Camera} variant="outline" disabled={left < 1} onPress={() => onAdd('camera')} style={styles.flex} />
      </View>

      <View style={styles.grid}>
        {photos.map((p, i) => {
          const uri = p.localUri ?? mediaUrl(p.url, 480);
          return (
            <View key={p.key} style={[styles.tile, { width: size, height: size, backgroundColor: c.elevated }]}>
              {uri ? <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              {i === 0 ? <Badge label="KAPAK" tone="primary" style={styles.cover} /> : null}
              {p.status === 'uploading' ? (
                <View style={[styles.overlay, { backgroundColor: c.overlay }]}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : p.status === 'error' ? (
                <Pressable onPress={() => onRetry(p.key)} style={[styles.overlay, { backgroundColor: 'rgba(180,35,24,0.7)' }]}>
                  <RotateCcw size={20} color="#fff" />
                  <Text variant="small" style={styles.white}>
                    Tekrar dene
                  </Text>
                </Pressable>
              ) : null}
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
                {i < photos.length - 1 ? (
                  <Tool label="Sağa taşı" onPress={() => onMove(p.key, 1)}>
                    <ArrowRight size={14} color="#fff" />
                  </Tool>
                ) : null}
                <View style={styles.flex} />
                <Tool label="Sil" onPress={() => onRemove(p.key)}>
                  <Trash2 size={14} color="#fff" />
                </Tool>
              </View>
            </View>
          );
        })}
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

      <View style={[styles.tips, { backgroundColor: c.elevated }]}>
        <Text variant="label">İpuçları</Text>
        <Text variant="caption" tone="muted">
          • Gün ışığında, ürünün tamamını gösteren fotoğraflar çekin.{'\n'}• En net fotoğrafı kapak yapın; ilk izlenim önemlidir.{'\n'}•
          Fotoğraflar oranı korunarak küçültülür ve filigran eklenir.
        </Text>
      </View>
    </View>
  );
}

function Tool({ children, label, onPress }: { children: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} onPress={onPress} style={styles.tool}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: space.lg },
  actions: { flexDirection: 'row', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { borderRadius: radius.md, overflow: 'hidden' },
  cover: { position: 'absolute', top: 6, left: 6 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 4 },
  white: { color: '#fff' },
  tools: { position: 'absolute', left: 4, right: 4, bottom: 4, flexDirection: 'row', gap: 4 },
  tool: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(13,17,23,0.6)', alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tips: { padding: space.md, borderRadius: radius.md, gap: space.xs },
});
