import { useSyncExternalStore } from "react";

/**
 * Unread counters for the signed-in user. The header loads them (and keeps them
 * fresh from the chat stream); other chrome such as the mobile bottom bar reads
 * them here instead of polling the server on its own.
 */
export type UnreadState = { messages: number; notifications: number };

const EMPTY: UnreadState = { messages: 0, notifications: 0 };
let state = EMPTY;
const listeners = new Set<() => void>();

export function setUnread(next: UnreadState | ((prev: UnreadState) => UnreadState)): void {
  state = typeof next === "function" ? next(state) : next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUnread(): UnreadState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}
