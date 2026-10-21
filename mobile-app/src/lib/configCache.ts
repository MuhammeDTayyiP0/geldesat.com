import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobileConfig } from '@/api/types';

/**
 * The last config the server sent, kept on the device. The app starts with it
 * (flags are right on the first frame, offline too) and swaps in the fresh one
 * as soon as it arrives.
 */

const KEY = 'geldesat.config.v1';
let cached: MobileConfig | undefined;

/** Read once at startup, before the first screen renders (see app/_layout.tsx). */
export async function loadCachedConfig(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as MobileConfig) : undefined;
  } catch {
    cached = undefined;
  }
}

export function cachedConfig(): MobileConfig | undefined {
  return cached;
}

export function rememberConfig(config: MobileConfig) {
  cached = config;
  AsyncStorage.setItem(KEY, JSON.stringify(config)).catch(() => {
    // Only a startup convenience.
  });
}
