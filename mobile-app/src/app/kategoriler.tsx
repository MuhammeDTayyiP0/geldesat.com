import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LayoutGrid } from 'lucide-react-native';
import { catalog } from '@/api/endpoints';
import { keys } from '@/api/queries';
import type { Category } from '@/api/types';
import { categoryIcon } from '@/features/catalog/categoryIcon';
import { formatNumber } from '@/lib/format';
import { Chip, Divider, ErrorState, Header, Loading, Text, hairline, radius, space, useTheme } from '@/ui';

/**
 * Category browser: one level at a time (the tree has thousands of rows and
 * stays on the server). "Bu kategorideki ilanlar" opens results at any level.
 */
export default function CategoriesScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { root } = useLocalSearchParams<{ root?: string }>();
  const [path, setPath] = useState<string[]>(root ? [root] : []);
  const level = useQuery({ queryKey: keys.browse(path), queryFn: () => catalog.browse(path), placeholderData: (prev) => prev });

  const pathRows = level.data?.pathRows ?? [];
  const current = pathRows[pathRows.length - 1];
  const children = level.data?.children ?? [];
  const counts = level.data?.counts ?? {};

  const openResults = (cat: Category) => router.push({ pathname: '/sonuclar', params: { category: cat.slug, title: cat.name } });

  const pick = (cat: Category) => {
    if (cat.has_children === false) openResults(cat);
    else setPath([...path, cat.id]);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header
        title={current?.name ?? 'Kategoriler'}
        onBack={path.length > (root ? 1 : 0) ? () => setPath(path.slice(0, -1)) : undefined}
      >
        {pathRows.length ? (
          <FlatList
            horizontal
            data={[{ id: '', name: 'Tümü' } as Category, ...pathRows]}
            keyExtractor={(item) => item.id || 'all'}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.crumbs}
            renderItem={({ item, index }) => (
              <View style={styles.crumb}>
                {index ? <ChevronRight size={14} color={c.subtle} /> : null}
                <Chip label={item.name} selected={index === pathRows.length} onPress={() => setPath(path.slice(0, index))} />
              </View>
            )}
          />
        ) : null}
      </Header>

      {level.isError && !level.data ? (
        <ErrorState error={level.error} onRetry={() => level.refetch()} />
      ) : !level.data ? (
        <Loading />
      ) : (
        <FlatList
          data={children}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            current ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => openResults(current)}
                style={({ pressed }) => [styles.allRow, { backgroundColor: pressed ? c.primarySoft : c.surface, borderColor: c.primary }]}
              >
                <LayoutGrid size={20} color={c.primary} />
                <Text variant="bodyStrong" tone="primary" style={styles.flex}>
                  “{current.name}” ilanlarının tümü
                </Text>
                {counts[current.id] ? (
                  <Text variant="caption" tone="primary">
                    {formatNumber(counts[current.id])}
                  </Text>
                ) : null}
                <ChevronRight size={18} color={c.primary} />
              </Pressable>
            ) : undefined
          }
          ItemSeparatorComponent={() => <Divider inset={path.length ? space.lg : 68} />}
          renderItem={({ item, index }) => {
            const { icon: Icon, tint } = categoryIcon(item.icon);
            const count = counts[item.id];
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => pick(item)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? c.elevated : c.surface, borderColor: c.border },
                  index === 0 && styles.first,
                  index === children.length - 1 && styles.last,
                ]}
              >
                {path.length === 0 ? (
                  <View style={[styles.icon, { backgroundColor: `${tint}1a` }]}>
                    <Icon size={22} color={tint} />
                  </View>
                ) : null}
                <Text style={styles.flex}>{item.name}</Text>
                {count ? (
                  <Text variant="caption" tone="subtle">
                    {formatNumber(count)}
                  </Text>
                ) : null}
                {item.has_children !== false ? <ChevronRight size={18} color={c.subtle} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text tone="muted" center style={styles.empty}>
              Bu kategoride alt kategori yok.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  crumbs: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.xs, alignItems: 'center' },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 56,
    borderLeftWidth: hairline,
    borderRightWidth: hairline,
  },
  first: { borderTopWidth: hairline, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomWidth: hairline, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: space.xl },
});
