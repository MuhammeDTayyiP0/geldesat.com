import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { API_BASE_URL } from './config';
import { deviceId } from './storage';

/**
 * Crash and error reports to our own server (/api/mobile/client-errors), so a
 * staged OTA rollout shows its error count in Admin → Uygulama güncellemeleri.
 * No account data is sent. A fatal error may end the app before the request
 * finishes, so reports are saved first and sent on the next launch if needed.
 */

type Report = {
  platform: 'ios' | 'android';
  appVersion?: string;
  updateId: string | null;
  deviceId?: string;
  fatal: boolean;
  message: string;
  stack?: string;
  screen?: string;
};

const PENDING_KEY = 'geldesat.pendingErrors.v1';
const MAX_PENDING = 10;
const sent = new Set<string>();
let screen: string | undefined;

/** The route on screen, attached to reports (set from the root layout). */
export function setErrorScreen(path: string) {
  screen = path;
}

function enabled() {
  return !__DEV__ && (Platform.OS === 'ios' || Platform.OS === 'android');
}

async function readPending(): Promise<Report[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Report[]) : [];
  } catch {
    return [];
  }
}

async function send(reports: Report[]): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/mobile/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ errors: reports }),
      signal: controller.signal,
    });
    // A rejected report (400, 429) will not get better by retrying.
    return response.ok || (response.status >= 400 && response.status < 500);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function reportError(error: unknown, options: { fatal?: boolean; screen?: string } = {}): Promise<void> {
  if (!enabled()) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const message = `${err.name}: ${err.message}`.slice(0, 500);
  // Once per message and launch: a render loop must not flood the server.
  if (sent.has(message)) return;
  sent.add(message);
  const report: Report = {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    appVersion: Constants.expoConfig?.version,
    updateId: Updates.isEmbeddedLaunch ? null : (Updates.updateId ?? null),
    deviceId: await deviceId(),
    fatal: Boolean(options.fatal),
    message,
    stack: err.stack?.slice(0, 4000),
    screen: options.screen ?? screen,
  };
  if (options.fatal) {
    const pending = await readPending();
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...pending, report].slice(-MAX_PENDING))).catch(() => undefined);
    await flushErrorReports();
    return;
  }
  if (!(await send([report]))) {
    const pending = await readPending();
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...pending, report].slice(-MAX_PENDING))).catch(() => undefined);
  }
}

/** Send reports saved by an earlier launch. Called once at startup. */
export async function flushErrorReports(): Promise<void> {
  if (!enabled()) return;
  const pending = await readPending();
  if (!pending.length) return;
  if (await send(pending)) await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsShape = { getGlobalHandler(): GlobalHandler; setGlobalHandler(handler: GlobalHandler): void };

/** Errors thrown outside React rendering (event handlers, timers) still reach React Native's handler after this. */
export function installGlobalErrorHandler() {
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!utils || !enabled()) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    void reportError(error, { fatal: isFatal });
    previous(error, isFatal);
  });
}
