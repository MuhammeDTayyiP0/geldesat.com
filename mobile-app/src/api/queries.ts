import { QueryClient, useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { ApiError } from './client';
import { account, catalog } from './endpoints';
import type { SearchFilters } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
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
  listing: (id: string) => ['listing', id] as const,
  seller: (id: string) => ['seller', id] as const,
  store: (slug: string) => ['store', slug] as const,
  legal: (slug: string) => ['legal', slug] as const,
  me: ['me'] as const,
  counts: ['counts'] as const,
  favorites: ['favorites'] as const,
  recent: ['recent'] as const,
  myListings: ['myListings'] as const,
  forEdit: (id: string) => ['forEdit', id] as const,
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

export function useConfig() {
  return useQuery({ queryKey: keys.config, queryFn: () => catalog.config(), staleTime: 5 * 60_000 });
}

export function useRoots() {
  return useQuery({ queryKey: keys.roots, queryFn: catalog.roots, staleTime: 10 * 60_000 });
}

/** Clear everything tied to the signed-in account (sign-out, account switch). */
export function clearPrivateQueries() {
  for (const key of [keys.me, keys.counts, keys.favorites, keys.myListings, keys.notifications, keys.settings, keys.blocked, keys.inbox, keys.templates]) {
    queryClient.removeQueries({ queryKey: key });
  }
  queryClient.removeQueries({ queryKey: ['thread'] });
  queryClient.removeQueries({ queryKey: ['listing'] });
}
