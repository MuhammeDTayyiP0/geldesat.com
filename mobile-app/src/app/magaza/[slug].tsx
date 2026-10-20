import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { listings } from '@/api/endpoints';
import { keys } from '@/api/queries';
import { ErrorState, Header, Loading, useTheme } from '@/ui';

/**
 * A store is shown on its owner's profile, so there is one public page per
 * member. Old store links (notifications, shared /magaza/… URLs) land here and
 * are replaced by that profile.
 */
export default function StoreRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const router = useRouter();
  const query = useQuery({ queryKey: keys.store(slug), queryFn: () => listings.store(slug) });
  const ownerId = query.data?.store.user_id;

  useEffect(() => {
    if (ownerId) router.replace({ pathname: '/satici/[id]', params: { id: ownerId } });
  }, [ownerId, router]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Mağaza" />
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : <Loading />}
    </View>
  );
}
