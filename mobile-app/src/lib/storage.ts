import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { Listing } from '@/api/types';

/** Small per-device lists (recently viewed, recent searches). Failures fall back to empty. */
async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

async function writeList<T>(key: string, items: T[]) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Storage full or unavailable: the list is only a convenience.
  }
}

const listeners = new Map<string, Set<() => void>>();
function notify(key: string) {
  for (const fn of listeners.get(key) ?? []) fn();
}

function useStoredList<T>(key: string): [T[], () => void] {
  const [items, setItems] = useState<T[]>([]);
  const reload = useCallback(() => {
    void readList<T>(key).then(setItems);
  }, [key]);
  useEffect(() => {
    reload();
    const set = listeners.get(key) ?? new Set();
    set.add(reload);
    listeners.set(key, set);
    return () => {
      set.delete(reload);
    };
  }, [key, reload]);
  return [items, reload];
}

// ─── Recently viewed listings ───────────────────────────────────────────────

const RECENT_KEY = 'geldesat.recentListings.v1';
export type RecentListing = Pick<Listing, 'id' | 'slug' | 'title' | 'price' | 'currency' | 'images' | 'city' | 'district' | 'created_at' | 'attrs'>;

export async function rememberListing(listing: Listing) {
  const item: RecentListing = {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    price: listing.price,
    currency: listing.currency,
    images: listing.images.slice(0, 1),
    city: listing.city,
    district: listing.district,
    created_at: listing.created_at,
    attrs: {},
  };
  const list = (await readList<RecentListing>(RECENT_KEY)).filter((x) => x.id !== listing.id);
  await writeList(RECENT_KEY, [item, ...list].slice(0, 20));
  notify(RECENT_KEY);
}

export async function clearRecentListings() {
  await writeList(RECENT_KEY, []);
  notify(RECENT_KEY);
}

export function useRecentListings() {
  return useStoredList<RecentListing>(RECENT_KEY)[0];
}

// ─── Recent searches ────────────────────────────────────────────────────────

const SEARCH_KEY = 'geldesat.recentSearches.v1';

export async function rememberSearch(q: string) {
  const term = q.trim();
  if (term.length < 2) return;
  const list = (await readList<string>(SEARCH_KEY)).filter((x) => x.toLocaleLowerCase('tr') !== term.toLocaleLowerCase('tr'));
  await writeList(SEARCH_KEY, [term, ...list].slice(0, 10));
  notify(SEARCH_KEY);
}

export async function forgetSearch(q: string) {
  await writeList(SEARCH_KEY, (await readList<string>(SEARCH_KEY)).filter((x) => x !== q));
  notify(SEARCH_KEY);
}

export async function clearSearches() {
  await writeList(SEARCH_KEY, []);
  notify(SEARCH_KEY);
}

export function useRecentSearches() {
  return useStoredList<string>(SEARCH_KEY)[0];
}

// ─── Listing draft (post wizard) ────────────────────────────────────────────

const DRAFT_KEY = 'geldesat.listingDraft.v1';

export async function saveDraft<T>(draft: T) {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export async function loadDraft<T>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function clearDraft() {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// ─── Misc flags ─────────────────────────────────────────────────────────────

const DEVICE_KEY = 'geldesat.deviceId.v1';

/** Stable random id for A/B buckets before sign-in. */
export async function deviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    await AsyncStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return 'guest';
  }
}
