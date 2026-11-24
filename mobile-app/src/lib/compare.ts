import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

export const MAX_COMPARE = 4;
const COMPARE_KEY = 'geldesat.compareList.v1';

export type CompareItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string | null;
};

const EMPTY: CompareItem[] = [];
let memoryCache: CompareItem[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CompareItem[] {
  return memoryCache ?? EMPTY;
}

async function readCompareList(): Promise<CompareItem[]> {
  if (memoryCache !== null) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(COMPARE_KEY);
    if (!raw) {
      memoryCache = EMPTY;
      notify();
      return memoryCache;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      memoryCache = EMPTY;
      notify();
      return memoryCache;
    }
    memoryCache = parsed
      .filter((x): x is CompareItem => Boolean(x && typeof x.id === 'string' && typeof x.title === 'string'))
      .slice(0, MAX_COMPARE);
    notify();
    return memoryCache;
  } catch {
    return EMPTY;
  }
}

async function writeCompareList(items: CompareItem[]): Promise<void> {
  const clean = items.slice(0, MAX_COMPARE);
  memoryCache = clean;
  notify();
  try {
    await AsyncStorage.setItem(COMPARE_KEY, JSON.stringify(clean));
  } catch {
    // Storage full or unavailable; memoryCache still keeps the session consistent.
  }
}

export async function toggleCompare(item: CompareItem): Promise<{ items: CompareItem[]; added: boolean; full: boolean }> {
  const current = await readCompareList();
  const exists = current.some((x) => x.id === item.id);
  if (exists) {
    const next = current.filter((x) => x.id !== item.id);
    await writeCompareList(next);
    return { items: next, added: false, full: false };
  }
  if (current.length >= MAX_COMPARE) {
    return { items: current, added: false, full: true };
  }
  const next = [...current, item];
  await writeCompareList(next);
  return { items: next, added: true, full: false };
}

export async function removeCompare(id: string): Promise<CompareItem[]> {
  const current = await readCompareList();
  const next = current.filter((x) => x.id !== id);
  await writeCompareList(next);
  return next;
}

export async function clearCompare(): Promise<void> {
  await writeCompareList([]);
}

export function useCompareList(): CompareItem[] {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (memoryCache === null) void readCompareList();
  }, []);
  return items;
}
