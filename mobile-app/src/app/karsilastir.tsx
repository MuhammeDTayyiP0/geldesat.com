import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ImageOff, Scale, Trash2, X } from 'lucide-react-native';
import { catalog } from '@/api/endpoints';
import { keys } from '@/api/queries';
import type { Listing } from '@/api/types';
import { mediaUrl } from '@/lib/config';
import { clearCompare, removeCompare, useCompareList } from '@/lib/compare';
import { useFlag } from '@/lib/flags';
import { formatDate, formatNumber, formatPrice, locationLabel } from '@/lib/format';
import { Button, EmptyState, ErrorState, Header, IconButton, Loading, Text, hairline, radius, space, useTheme } from '@/ui';

function formatAttr(value: unknown, key?: string): string {
  if (value === undefined || value === null || value === '') return '—';
  if (value === true || value === 'true') return 'Evet';
  if (value === false || value === 'false') return 'Hayır';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') return key === 'Yıl' || key === 'Model Yılı' ? String(value) : formatNumber(value);
  return String(value);
}

type SpecRow = {
  key: string;
  label: string;
  values: string[];
  differs: boolean;
};

export default function CompareScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const compareOn = useFlag('ilan_karsilastirma');
  const savedItems = useCompareList();
  const ids = useMemo(() => savedItems.map((i) => i.id), [savedItems]);

  const query = useQuery({
    queryKey: keys.compare(ids),
    queryFn: () => catalog.byIds(ids),
    enabled: compareOn && ids.length > 0,
  });

  const listingsById = useMemo(() => {
    const map = new Map<string, Listing>();
    for (const l of query.data ?? []) map.set(l.id, l);
    return map;
  }, [query.data]);

  const columns = useMemo(
    () =>
      savedItems.map((item) => ({
        saved: item,
        live: listingsById.get(item.id) ?? null,
      })),
    [savedItems, listingsById],
  );

  const attrKeys = useMemo(() => {
    const keysSet = new Set<string>();
    for (const col of columns) {
      if (!col.live) continue;
      for (const [k, v] of Object.entries(col.live.attrs ?? {})) {
        if (!k.startsWith('_') && v !== '' && v != null) keysSet.add(k);
      }
    }
    return [...keysSet];
  }, [columns]);

  const specRows = useMemo<SpecRow[]>(() => {
    const makeRow = (key: string, label: string, values: string[]): SpecRow => ({
      key,
      label,
      values,
      differs: values.length > 1 && new Set(values).size > 1,
    });
    return [
      makeRow(
        'price',
        'Fiyat',
        columns.map((col) =>
          col.live ? formatPrice(col.live.price, col.live.currency) : formatPrice(col.saved.price, col.saved.currency),
        ),
      ),
      makeRow(
        'category',
        'Kategori',
        columns.map((col) => col.live?.category_name ?? '—'),
      ),
      makeRow(
        'location',
        'Konum',
        columns.map((col) =>
          col.live ? locationLabel(col.live.city, col.live.district, col.live.neighborhood) || '—' : '—',
        ),
      ),
      makeRow(
        'listing_no',
        'İlan No',
        columns.map((col) => (col.live?.listing_no ? `#${col.live.listing_no}` : '—')),
      ),
      makeRow(
        'created_at',
        'İlan tarihi',
        columns.map((col) => (col.live ? formatDate(col.live.created_at) : '—')),
      ),
      makeRow(
        'seller',
        'Satıcı',
        columns.map((col) => (col.live ? (col.live.store_name ?? col.live.seller_name ?? '—') : '—')),
      ),
      ...attrKeys.map((attrKey) =>
        makeRow(
          `attr:${attrKey}`,
          attrKey,
          columns.map((col) => (col.live ? formatAttr(col.live.attrs?.[attrKey], attrKey) : '—')),
        ),
      ),
    ];
  }, [columns, attrKeys]);

  if (!compareOn) {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <Header title="İlan karşılaştır" />
        <EmptyState
          icon={Scale}
          title="Karşılaştırma şu an kullanımda değil"
          message="Bu özellik yakında açılacaktır."
          action={<Button title="Ana sayfaya dön" onPress={() => router.replace('/')} />}
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header
        title="İlan karşılaştır"
        subtitle={savedItems.length ? `${savedItems.length} / 4 ilan` : undefined}
        right={
          savedItems.length ? (
            <Button title="Temizle" icon={Trash2} size="sm" variant="ghost" onPress={() => void clearCompare()} />
          ) : undefined
        }
      />

      {savedItems.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Karşılaştırma listeniz boş"
          message="İlan detaylarından en fazla 4 ilanı karşılaştırma listesine ekleyebilirsiniz."
          action={<Button title="İlanları keşfet" onPress={() => router.replace('/')} />}
        />
      ) : query.isLoading && !query.data ? (
        <Loading label="İlanlar yükleniyor…" />
      ) : query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={[styles.vertical, { paddingBottom: insets.bottom + space.xxxl }]}>
          <View style={[styles.frame, { borderColor: c.border, backgroundColor: c.surface }]}>
            {/* Sticky left label column */}
            <View style={[styles.stickyCol, { borderRightColor: c.border, backgroundColor: c.surface }]}>
              <View style={[styles.stickyHeader, { borderBottomColor: c.border, backgroundColor: c.elevated }]}>
                <Scale size={18} color={c.primary} />
                <Text variant="label" tone="muted" center>
                  İlanlar ({columns.length})
                </Text>
              </View>
              {specRows.map((row, idx) => (
                <View
                  key={row.key}
                  style={[
                    styles.stickyRowCell,
                    { borderTopColor: c.border },
                    idx % 2 === 0 && { backgroundColor: c.elevated },
                  ]}
                >
                  <Text variant="caption" tone="muted" numberOfLines={2} style={styles.flex}>
                    {row.label}
                  </Text>
                  {row.differs ? <View style={[styles.diffDot, { backgroundColor: c.primary }]} /> : null}
                </View>
              ))}
            </View>

            {/* Horizontally scrollable value columns */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex}>
              <View>
                <View style={[styles.cardsRow, { borderBottomColor: c.border }]}>
                  {columns.map(({ saved, live }, colIdx) => {
                    const thumb = mediaUrl((live?.images[0] ?? saved.image) || undefined, 480);
                    const title = live?.title ?? saved.title;
                    const price = live ? formatPrice(live.price, live.currency) : formatPrice(saved.price, saved.currency);
                    return (
                      <View
                        key={saved.id}
                        style={[
                          styles.colCard,
                          colIdx > 0 && { borderLeftColor: c.border, borderLeftWidth: hairline },
                        ]}
                      >
                        <Pressable
                          onPress={() => router.push({ pathname: '/ilan/[id]', params: { id: saved.id } })}
                          style={styles.cardPress}
                        >
                          <View style={[styles.thumb, { backgroundColor: c.elevated }]}>
                            {thumb ? (
                              <Image source={thumb} style={StyleSheet.absoluteFill} contentFit="cover" />
                            ) : (
                              <ImageOff size={22} color={c.subtle} />
                            )}
                          </View>
                          <View style={styles.cardInfo}>
                            <Text variant="bodyStrong" tone="primary" numberOfLines={1}>
                              {price}
                            </Text>
                            <Text variant="caption" numberOfLines={2}>
                              {title}
                            </Text>
                            {!live ? (
                              <Text variant="small" tone="warn">
                                Yayında değil
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                        <View style={styles.removeBtn}>
                          <IconButton icon={X} label={`${title} çıkar`} size={28} tone="onImage" onPress={() => void removeCompare(saved.id)} />
                        </View>
                      </View>
                    );
                  })}
                </View>

                {specRows.map((row, idx) => (
                  <View
                    key={row.key}
                    style={[
                      styles.valuesRow,
                      { borderTopColor: c.border },
                      idx % 2 === 0 && { backgroundColor: c.elevated },
                    ]}
                  >
                    {row.values.map((val, colIdx) => (
                      <View
                        key={colIdx}
                        style={[
                          styles.valueCell,
                          colIdx > 0 && { borderLeftColor: c.border, borderLeftWidth: hairline },
                        ]}
                      >
                        <Text
                          variant={row.differs ? 'label' : 'caption'}
                          tone={row.key === 'price' ? 'primary' : row.differs ? 'default' : 'muted'}
                          numberOfLines={2}
                        >
                          {val}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const COL_WIDTH = 164;
const LABEL_WIDTH = 116;
const HEADER_HEIGHT = 212;
const ROW_HEIGHT = 48;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  vertical: { padding: space.lg },
  frame: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: hairline,
    overflow: 'hidden',
  },
  stickyCol: {
    width: LABEL_WIDTH,
    borderRightWidth: hairline,
  },
  stickyHeader: {
    height: HEADER_HEIGHT,
    padding: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderBottomWidth: hairline,
  },
  stickyRowCell: {
    height: ROW_HEIGHT,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderTopWidth: hairline,
  },
  diffDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  cardsRow: {
    flexDirection: 'row',
    height: HEADER_HEIGHT,
    borderBottomWidth: hairline,
  },
  colCard: {
    width: COL_WIDTH,
    height: HEADER_HEIGHT,
  },
  cardPress: { flex: 1 },
  thumb: { width: '100%', height: 118, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { padding: space.sm, gap: 4 },
  removeBtn: { position: 'absolute', top: space.xs, right: space.xs },
  valuesRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    borderTopWidth: hairline,
  },
  valueCell: {
    width: COL_WIDTH,
    height: ROW_HEIGHT,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
});
