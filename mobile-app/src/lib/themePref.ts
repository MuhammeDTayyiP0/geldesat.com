import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Appearance choice: follow the device, or force light / dark. */
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'geldesat.theme.v1';
let current: ThemePref = 'system';
const listeners = new Set<() => void>();

function apply(pref: ThemePref) {
  // Overriding the app's colour scheme also switches native UI (alerts, keyboard) and useColorScheme().
  if (Platform.OS !== 'web') Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

/** Read the saved choice before the first screen renders (called while the splash screen is up). */
export async function loadThemePref(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') current = saved;
  } catch {
    // Default stays "system".
  }
  apply(current);
}

export function setThemePref(pref: ThemePref) {
  current = pref;
  apply(pref);
  for (const listener of listeners) listener();
  void AsyncStorage.setItem(KEY, pref).catch(() => undefined);
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}
