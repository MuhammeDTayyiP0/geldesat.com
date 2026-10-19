import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { useRequireAuth } from '@/auth/useRequireAuth';
import { errorMessage } from '@/api/client';
import { listings } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { Listing, ListingDetail } from '@/api/types';
import { toast } from '@/ui';

export function useFavorites() {
  const session = useSession();
  return useQuery({ queryKey: keys.favorites, queryFn: listings.favorites, enabled: session.status === 'signedIn' });
}

export function useFavoriteIds(): Set<string> {
  const { data } = useFavorites();
  return useMemo(() => new Set((data ?? []).map((l) => l.id)), [data]);
}

/** Toggle a favorite with an optimistic update of the list and the open detail page. */
export function useToggleFavorite() {
  const requireAuth = useRequireAuth();
  const mutation = useMutation({
    mutationFn: (listing: Listing) => listings.toggleFavorite(listing.id),
    onMutate: async (listing) => {
      await queryClient.cancelQueries({ queryKey: keys.favorites });
      const previous = queryClient.getQueryData<Listing[]>(keys.favorites);
      const wasFavorite = previous?.some((l) => l.id === listing.id) ?? false;
      queryClient.setQueryData<Listing[]>(keys.favorites, (list = []) =>
        wasFavorite ? list.filter((l) => l.id !== listing.id) : [listing, ...list],
      );
      queryClient.setQueryData<ListingDetail>(keys.listing(listing.id), (d) =>
        d ? { ...d, isFavorite: !wasFavorite, favoriteCount: d.favoriteCount + (wasFavorite ? -1 : 1) } : d,
      );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return { previous, wasFavorite };
    },
    onError: (error, listing, context) => {
      queryClient.setQueryData(keys.favorites, context?.previous);
      queryClient.setQueryData<ListingDetail>(keys.listing(listing.id), (d) =>
        d && context ? { ...d, isFavorite: context.wasFavorite, favoriteCount: d.favoriteCount + (context.wasFavorite ? 1 : -1) } : d,
      );
      toast.error(errorMessage(error));
    },
    onSuccess: (favorite) => {
      if (favorite) toast.success('Favorilere eklendi');
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
  return (listing: Listing) => {
    if (!requireAuth('Favorilere eklemek için giriş yapın.')) return;
    mutation.mutate(listing);
  };
}
