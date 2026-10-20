import { useEffect, useSyncExternalStore } from "react";
import { favoriteIds } from "@/lib/server/social";

/**
 * The signed-in user's favorite listing ids, loaded once and shared by every
 * card on the page so hearts show the right state (as in the app).
 */
const EMPTY: ReadonlySet<string> = new Set();
let ids: ReadonlySet<string> = EMPTY;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Record a heart toggle so other cards for the same listing follow. */
export function setFavorite(listingId: string, favorite: boolean): void {
  const next = new Set(ids);
  if (favorite) next.add(listingId);
  else next.delete(listingId);
  ids = next;
  emit();
}

/** Favorite ids for `userId` (empty when signed out); fetched on first use per user. */
export function useFavoriteIds(userId: string | null | undefined): ReadonlySet<string> {
  useEffect(() => {
    if (!userId) {
      if (loadedFor) {
        loadedFor = null;
        ids = EMPTY;
        emit();
      }
      return;
    }
    if (loadedFor === userId) return;
    loadedFor = userId;
    favoriteIds()
      .then((rows) => {
        if (loadedFor !== userId) return;
        ids = new Set(rows);
        emit();
      })
      .catch(() => {
        if (loadedFor === userId) loadedFor = null;
      });
  }, [userId]);
  return useSyncExternalStore(subscribe, () => ids, () => EMPTY);
}
