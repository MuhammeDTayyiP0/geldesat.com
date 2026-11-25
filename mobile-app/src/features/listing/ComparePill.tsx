import { Pressable, StyleSheet, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ImageOff, Scale, X } from 'lucide-react-native';
import { clearCompare, useCompareList } from '@/lib/compare';
import { mediaUrl } from '@/lib/config';
import { useFlag } from '@/lib/flags';
import { Text, hairline, radius, shadow, space, useTheme } from '@/ui';

const TAB_ROUTES = new Set(['/', '/ara', '/mesajlar', '/hesap']);

/** Floating shortcut bar while items are queued for side-by-side comparison. */
export function ComparePill() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const compareOn = useFlag('ilan_karsilastirma');
  const items = useCompareList();

  if (
    !compareOn ||
    items.length === 0 ||
    pathname === '/karsilastir' ||
    pathname === '/ilan-ver' ||
    pathname === '/giris' ||
    pathname === '/kayit' ||
    pathname.startsWith('/mesaj/') ||
    pathname.startsWith('/ilan/')
  ) {
    return null;
  }

  const onTabBar = TAB_ROUTES.has(pathname);
  const bottom = onTabBar ? Math.max(insets.bottom, space.sm) + 74 : insets.bottom + space.lg;

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom }]}>
      <View
        style={[
          styles.pill,
          { backgroundColor: c.surface, borderColor: c.border },
          shadow(2),
        ]}
      >
        <View style={styles.thumbs}>
          {items.slice(0, 3).map((item, idx) => {
            const thumb = mediaUrl(item.image ?? undefined, 240);
            return (
              <View
                key={item.id}
                style={[
                  styles.thumbWrap,
                  {
                    backgroundColor: c.elevated,
                    borderColor: c.surface,
                    marginLeft: idx === 0 ? 0 : -10,
                  },
                ]}
              >
                {thumb ? (
                  <Image source={thumb} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <ImageOff size={13} color={c.subtle} />
                )}
              </View>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Karşılaştır, ${items.length} ilan`}
          onPress={() => router.push('/karsilastir' as Href)}
          style={[styles.cta, { backgroundColor: c.primarySolid }]}
        >
          <Scale size={15} color={c.onPrimary} />
          <Text variant="label" tone="onPrimary" numberOfLines={1}>
            Karşılaştır ({items.length})
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Karşılaştırma listesini temizle"
          hitSlop={8}
          onPress={() => void clearCompare()}
          style={[styles.clearBtn, { backgroundColor: c.elevated }]}
        >
          <X size={15} color={c.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
    zIndex: 30,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    borderWidth: hairline,
    maxWidth: 420,
  },
  thumbs: { flexDirection: 'row', alignItems: 'center', paddingLeft: 2 },
  thumbWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  clearBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
