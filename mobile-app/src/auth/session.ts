import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type SessionUser = { id: string; email: string; name: string };

export type SessionState =
  | { status: 'loading'; user: null; token: null }
  | { status: 'signedOut'; user: null; token: null }
  | { status: 'signedIn'; user: SessionUser; token: string };

const STORE_KEY = 'geldesat.session.v2';

/** Keychain on devices; localStorage in a development browser (SecureStore has no web support). */
const storage = {
  get: (key: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null) : SecureStore.getItemAsync(key)),
  set: (key: string, value: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(key, value)) : SecureStore.setItemAsync(key, value),
  remove: (key: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(key)) : SecureStore.deleteItemAsync(key)),
};

let state: SessionState = { status: 'loading', user: null, token: null };
const listeners = new Set<() => void>();

function emit(next: SessionState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSession(): SessionState {
  return state;
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSession, getSession);
}

export function getToken(): string | null {
  return state.token;
}

export async function saveSession(user: SessionUser, token: string): Promise<void> {
  emit({ status: 'signedIn', user, token });
  try {
    await storage.set(STORE_KEY, JSON.stringify({ user, token }));
  } catch {
    // Keychain may be unavailable (e.g. locked device on first launch); the session still works in memory.
  }
}

export async function clearSession(): Promise<void> {
  emit({ status: 'signedOut', user: null, token: null });
  try {
    await storage.remove(STORE_KEY);
  } catch {
    // Nothing stored.
  }
}

export function updateSessionUser(patch: Partial<SessionUser>) {
  if (state.status !== 'signedIn') return;
  void saveSession({ ...state.user, ...patch }, state.token);
}

/** Read the stored session; the caller validates it against the server. */
export async function loadStoredSession(): Promise<{ user: SessionUser; token: string } | null> {
  try {
    const raw = await storage.get(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: SessionUser; token?: string };
    return parsed.user?.id && parsed.token ? { user: parsed.user, token: parsed.token } : null;
  } catch {
    return null;
  }
}

export function setSignedOut() {
  emit({ status: 'signedOut', user: null, token: null });
}

export function setSignedIn(user: SessionUser, token: string) {
  emit({ status: 'signedIn', user, token });
}
