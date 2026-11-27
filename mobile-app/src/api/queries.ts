import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { QueryClient, focusManager, onlineManager, useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { cachedConfig, rememberConfig } from '@/lib/configCache';
import { deviceId } from '@/lib/storage';
import { ApiError } from './client';
import { account, catalog } from './endpoints';
import type { SearchFilters } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, error) => !(error instanceof ApiError && (error.status === 0 || (error.status >= 400 && error.status < 500))) && count < 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

/** Every query key in one place, so mutations can invalidate precisely. */
export const keys = {
  config: ['config'] as const,
  stats: ['stats'] as const,
  roots: ['categories', 'roots'] as const,
  browse: (path: string[]) => ['categories', 'browse', ...path] as const,
  category: (slug: string) => ['categories', 'info', slug] as const,
  attributes: (categoryId: string) => ['categories', 'attrs', categoryId] as const,
  search: (filters: SearchFilters) => ['search', filters] as const,
  rail: (name: string) => ['rail', name] as const,
  homeRails: ['rail', 'home'] as const,
  listing: (id: string) => ['listing', id] as const,
  seller: (id: string) => ['seller', id] as const,
  store: (slug: string) => ['store', slug] as const,
  legal: (slug: string) => ['legal', slug] as const,
  cityCounts: ['cityCounts'] as const,
  mapListings: (params: Record<string, unknown>) => ['mapListings', params] as const,
  compare: (ids: string[]) => ['compare', ...ids] as const,
  me: ['me'] as const,
  counts: ['counts'] as const,
  favorites: ['favorites'] as const,
  recent: ['recent'] as const,
  savedSearches: ['savedSearches'] as const,
  myListings: ['myListings'] as const,
  forEdit: (id: string) => ['forEdit', id] as const,
  followStatus: (sellerId: string) => ['followStatus', sellerId] as const,
  followedSellers: ['followedSellers'] as const,
  storeApplication: ['storeApplication'] as const,
  notifications: ['notifications'] as const,
  settings: ['settings'] as const,
  deletion: ['deletion'] as const,
  blocked: ['blocked'] as const,
  inbox: ['inbox'] as const,
  thread: (id: string) => ['thread', id] as const,
  templates: ['templates'] as const,
};

export function useMe() {
  const session = useSession();
  return useQuery({
    queryKey: keys.me,
    queryFn: account.me,
    enabled: session.status === 'signedIn',
    staleTime: 60_000,
  });
}

/** Unread notifications and messages, for the tab badges. */
export function useCounts() {
  const session = useSession();
  return useQuery({
    queryKey: keys.counts,
    queryFn: account.counts,
    enabled: session.status === 'signedIn',
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

/**
 * Server config and this person's feature flags. Starts from the copy saved on
 * the device, refetches on sign-in / sign-out (flags follow the account) and
 * when the app returns to the foreground after a few minutes.
 */
export function useConfig() {
  const session = useSession();
  const userId = session.status === 'signedIn' ? session.user.id : session.status;
  return useQuery({
    queryKey: [...keys.config, userId],
    queryFn: async () => {
      const config = await catalog.config({ deviceId: await deviceId(), platform: Platform.OS, appVersion: Constants.expoConfig?.version });
      rememberConfig(config, userId);
      return config;
    },
    enabled: session.status !== 'loading',
    // The saved copy only stands in for the account it was fetched for.
    placeholderData: () => cachedConfig(userId),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}

// React Query's "window focus" is the app coming back to the foreground.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => {
    const active = state === 'active';
    if (active) onlineManager.setOnline(true);
    setFocused(active);
  });
  return () => sub.remove();
});

export function useRoots() {
  return useQuery({ queryKey: keys.roots, queryFn: catalog.roots, staleTime: 10 * 60_000 });
}

/** Queries that look the same to everyone; all others belong to the signed-in account. */
const PUBLIC_QUERIES = new Set(['stats', 'categories', 'search', 'rail', 'seller', 'store', 'legal', 'cityCounts', 'mapListings', 'compare']);

/**
 * Clear everything tied to the signed-in account (sign-out, expired session,
 * account switch). Listing details go too: they carry the favorite and owner state.
 */
export function clearPrivateQueries() {
  queryClient.removeQueries({ predicate: (query) => !PUBLIC_QUERIES.has(String(query.queryKey[0])) });
}
