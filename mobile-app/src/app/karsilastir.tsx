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

function formatAttr(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (value === true || value === 'true') return 'Evet';
  if (value === false || value === 'false') return 'Hayır';
  if (Array.isArray(value)) return value.join(', ');
  return typeof value === 'number' ? formatNumber(value) : String(value);
}

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
            <View>
              {/* Header cards */}
              <View style={styles.row}>
                <View style={[styles.labelCol, styles.headerLabelSpacer]} />
                {columns.map(({ saved, live }) => {
                  const thumb = mediaUrl((live?.images[0] ?? saved.image) || undefined, 480);
                  const title = live?.title ?? saved.title;
                  const price = live ? formatPrice(live.price, live.currency) : formatPrice(saved.price, saved.currency);
                  return (
                    <View key={saved.id} style={[styles.colCard, { backgroundColor: c.surface, borderColor: c.border }]}>
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
                          <Text variant="caption" numberOfLines={2} style={styles.cardTitle}>
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

              {/* Spec table */}
              <View style={[styles.table, { backgroundColor: c.surface, borderColor: c.border }]}>
                <CompareRow
                  label="Kategori"
                  values={columns.map((col) => col.live?.category_name ?? '—')}
                />
                <CompareRow
                  label="Konum"
                  values={columns.map((col) =>
                    col.live ? locationLabel(col.live.city, col.live.district, col.live.neighborhood) || '—' : '—',
                  )}
                />
                <CompareRow
                  label="İlan tarihi"
                  values={columns.map((col) => (col.live ? formatDate(col.live.created_at) : '—'))}
                />
                <CompareRow
                  label="Satıcı"
                  values={columns.map((col) => (col.live ? (col.live.store_name ?? col.live.seller_name ?? '—') : '—'))}
                />
                {attrKeys.map((attrKey) => (
                  <CompareRow
                    key={attrKey}
                    label={attrKey}
                    values={columns.map((col) => (col.live ? formatAttr(col.live.attrs?.[attrKey]) : '—'))}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

function CompareRow({ label, values }: { label: string; values: string[] }) {
  const { c } = useTheme();
  return (
    <View style={[styles.tableRow, { borderTopColor: c.border }]}>
      <View style={[styles.labelCol, styles.tableLabelCell, { backgroundColor: c.elevated }]}>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {label}
        </Text>
      </View>
      {values.map((val, idx) => (
        <View key={idx} style={[styles.valueCol, styles.tableValueCell, { borderLeftColor: c.border }]}>
          <Text variant="caption" numberOfLines={3}>
            {val}
          </Text>
        </View>
      ))}
    </View>
  );
}

const COL_WIDTH = 164;
const LABEL_WIDTH = 112;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  vertical: { paddingVertical: space.lg },
  horizontal: { paddingHorizontal: space.lg },
  row: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  labelCol: { width: LABEL_WIDTH },
  headerLabelSpacer: { justifyContent: 'flex-end' },
  colCard: {
    width: COL_WIDTH,
    borderRadius: radius.lg,
    borderWidth: hairline,
    overflow: 'hidden',
  },
  cardPress: { flex: 1 },
  thumb: { width: '100%', aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { padding: space.sm, gap: 4 },
  cardTitle: { minHeight: 34 },
  removeBtn: { position: 'absolute', top: space.xs, right: space.xs },
  table: { borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderTopWidth: hairline },
  tableLabelCell: { padding: space.md, justifyContent: 'center' },
  valueCol: { width: COL_WIDTH + space.sm },
  tableValueCell: { padding: space.md, justifyContent: 'center', borderLeftWidth: hairline },
});
