import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { Listing } from '@/api/types';
import { useSession } from '@/auth/session';
import { Skeleton, Text, space, useTheme } from '@/ui';
import { ListingCard } from './ListingCard';
import { useFavoriteIds, useToggleFavorite } from './favorites';

type RailListing = Parameters<typeof ListingCard>[0]['listing'] & { id: string };

/** Horizontal strip of listing cards with a title and "Tümü" link. */
export function ListingRail({
  title,
  subtitle,
  items,
  loading,
  onSeeAll,
}: {
  title: string;
  subtitle?: string;
  items: RailListing[] | undefined;
  loading?: boolean;
  onSeeAll?: () => void;
}) {
  const { c } = useTheme();
  const router = useRouter();
  const favoriteIds = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const session = useSession();
  const me = session.status === 'signedIn' ? session.user.id : null;
  const open = useCallback((item: { id: string }) => router.push({ pathname: '/ilan/[id]', params: { id: item.id } }), [router]);
  const favorite = useCallback((item: { id: string }) => toggleFavorite(item as Listing), [toggleFavorite]);
  if (!loading && !items?.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="subheading">{title}</Text>
          {subtitle ? (
            <Text variant="caption" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onSeeAll ? (
          <Pressable accessibilityRole="link" hitSlop={8} onPress={onSeeAll} style={styles.all}>
            <Text variant="label" tone="primary">
              Tümü
            </Text>
            <ChevronRight size={16} color={c.primary} />
          </Pressable>
        ) : null}
      </View>
      {loading && !items?.length ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeleton}>
              <Skeleton height={126} rounded={14} />
              <Skeleton width="60%" height={14} />
              <Skeleton width="90%" height={12} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListingCard
              layout="rail"
              listing={item}
              favorite={favoriteIds.has(item.id)}
              onFavorite={'user_id' in item && item.user_id === me ? undefined : favorite}
              onPress={open}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.lg },
  all: { flexDirection: 'row', alignItems: 'center' },
  list: { paddingHorizontal: space.lg, gap: space.md },
  skeletons: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg },
  skeleton: { width: 168, gap: space.sm },
});
