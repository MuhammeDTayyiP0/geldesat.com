import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobileConfig } from '@/api/types';

/**
 * The last config the server sent, kept on the device. The app starts with it
 * (flags are right on the first frame, offline too) and swaps in the fresh one
 * as soon as it arrives.
 */

const KEY = 'geldesat.config.v2';
/** `owner`: the account id the flags were resolved for, or "signedOut". */
let cached: { owner: string; config: MobileConfig } | undefined;

/** Read once at startup, before the first screen renders (see app/_layout.tsx). */
export async function loadCachedConfig(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as { owner: string; config: MobileConfig }) : undefined;
  } catch {
    cached = undefined;
  }
}

export function cachedConfig(owner: string): MobileConfig | undefined {
  return cached?.owner === owner ? cached.config : undefined;
}

export function rememberConfig(config: MobileConfig, owner: string) {
  cached = { owner, config };
  AsyncStorage.setItem(KEY, JSON.stringify(cached)).catch(() => {
    // Only a startup convenience.
  });
}
