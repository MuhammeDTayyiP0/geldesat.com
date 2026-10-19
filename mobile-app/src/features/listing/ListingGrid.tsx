import type { ReactElement } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import type { Listing } from '@/api/types';
import { Skeleton, space, useTheme } from '@/ui';
import { ListingCard } from './ListingCard';
import { useFavoriteIds, useToggleFavorite } from './favorites';

type Props = {
  listings: Listing[];
  layout?: 'grid' | 'list';
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  header?: ReactElement | null;
  empty?: ReactElement | null;
  bottomInset?: number;
};

export function ListingGrid({
  listings,
  layout = 'grid',
  loading,
  refreshing = false,
  onRefresh,
  onEndReached,
  loadingMore,
  header,
  empty,
  bottomInset = 0,
}: Props) {
  const { c } = useTheme();
  const router = useRouter();
  const favoriteIds = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const grid = layout === 'grid';

  return (
    <FlashList
      key={layout}
      data={listings}
      numColumns={grid ? 2 : 1}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.xxl + bottomInset }}
      ListHeaderComponent={header}
      ListEmptyComponent={loading ? <GridSkeleton grid={grid} /> : empty}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      keyboardDismissMode="on-drag"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} /> : undefined}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={c.primary} style={styles.more} /> : null}
      renderItem={({ item }) => (
        <View style={grid ? styles.gridCell : styles.listCell}>
          <ListingCard
            layout={grid ? 'grid' : 'row'}
            listing={item}
            favorite={favoriteIds.has(item.id)}
            onFavorite={() => toggleFavorite(item)}
            onPress={() => router.push({ pathname: '/ilan/[id]', params: { id: item.id } })}
          />
        </View>
      )}
    />
  );
}

export function GridSkeleton({ grid = true, count = 6 }: { grid?: boolean; count?: number }) {
  return (
    <View style={grid ? styles.skeletonGrid : styles.skeletonList}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={grid ? styles.skeletonCard : styles.skeletonRow}>
          <Skeleton height={grid ? 120 : 96} width={grid ? '100%' : 120} rounded={12} />
          <View style={styles.skeletonText}>
            <Skeleton width="55%" height={15} />
            <Skeleton width="90%" height={12} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gridCell: { flex: 1, padding: space.xs + 1 },
  listCell: { paddingVertical: space.xs + 1, paddingHorizontal: space.xs },
  more: { paddingVertical: space.xl },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.xs },
  skeletonList: { gap: space.md, paddingHorizontal: space.xs },
  skeletonCard: { width: '50%', padding: space.xs + 1, gap: space.sm, marginBottom: space.md },
  skeletonRow: { flexDirection: 'row', gap: space.md },
  skeletonText: { flex: 1, gap: space.sm, paddingTop: space.xs },
});
