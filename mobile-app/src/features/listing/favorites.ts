import { useCallback, useMemo } from 'react';
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

/**
 * Whether the listing is a favorite right now: from the favorites list when it
 * has loaded, otherwise from an open detail page (opened by id, slug or number).
 */
function currentlyFavorite(listingId: string): boolean {
  const list = queryClient.getQueryData<Listing[]>(keys.favorites);
  if (list) return list.some((l) => l.id === listingId);
  for (const [, detail] of queryClient.getQueriesData<ListingDetail>({ queryKey: ['listing'] })) {
    if (detail?.listing.id === listingId) return detail.isFavorite;
  }
  return false;
}

/** Set the favorite state everywhere it shows: the list and every detail page of this listing. */
function showFavorite(listing: Listing, favorite: boolean) {
  queryClient.setQueryData<Listing[]>(keys.favorites, (list) => {
    if (!list) return list;
    const has = list.some((l) => l.id === listing.id);
    if (favorite === has) return list;
    return favorite ? [listing, ...list] : list.filter((l) => l.id !== listing.id);
  });
  queryClient.setQueriesData<ListingDetail>({ queryKey: ['listing'] }, (d) =>
    d && d.listing.id === listing.id && d.isFavorite !== favorite
      ? { ...d, isFavorite: favorite, favoriteCount: Math.max(0, d.favoriteCount + (favorite ? 1 : -1)) }
      : d,
  );
}

/** Toggle a favorite: shown at once, then set to what the server says. */
export function useToggleFavorite() {
  const requireAuth = useRequireAuth();
  const { mutate } = useMutation({
    mutationFn: (listing: Listing) => listings.toggleFavorite(listing.id),
    onMutate: async (listing) => {
      await queryClient.cancelQueries({ queryKey: keys.favorites });
      const wasFavorite = currentlyFavorite(listing.id);
      showFavorite(listing, !wasFavorite);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return { wasFavorite };
    },
    onError: (error, listing, context) => {
      if (context) showFavorite(listing, context.wasFavorite);
      toast.error(errorMessage(error));
    },
    onSuccess: (favorite, listing) => {
      showFavorite(listing, favorite);
      if (favorite) toast.success('Favorilere eklendi');
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
  // Stable, so memoized cards do not re-render when a parent does.
  return useCallback(
    (listing: Listing) => {
      if (!requireAuth('Favorilere eklemek için giriş yapın.')) return;
      mutate(listing);
    },
    [requireAuth, mutate],
  );
}
