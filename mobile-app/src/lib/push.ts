import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { account } from '@/api/endpoints';
import { getSession } from '@/auth/session';

const PUSH_KEY = 'geldesat.pushToken.v1';

type StoredPush = { token: string; userId: string | null };

function parseStoredPush(raw: string | null): StoredPush | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: unknown; userId?: unknown };
    if (typeof parsed?.token === 'string' && parsed.token) {
      return { token: parsed.token, userId: typeof parsed.userId === 'string' ? parsed.userId : null };
    }
  } catch {
    return { token: raw, userId: null };
  }
  return null;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Ask for notification permission (once) and register this device's Expo push
 * token with the account. Silent no-op on simulators or when declined.
 */
export async function registerForPush({ ask = true }: { ask?: boolean } = {}): Promise<void> {
  if (!Device.isDevice || Platform.OS === 'web') return;
  const session = getSession();
  if (session.status !== 'signedIn') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Bildirimler',
      // eslint-disable-next-line import/namespace -- re-exported from NotificationChannelManager.types; the resolver misses it
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#1a4fd8',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && ask && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await account.registerPush(token);
  await AsyncStorage.setItem(PUSH_KEY, JSON.stringify({ token, userId: session.user.id }));
}

/**
 * Permission given later in the phone's settings: register then, without asking.
 * Called when the app returns to the foreground; does nothing once registered for the current user.
 */
export async function ensurePushRegistered(): Promise<void> {
  if (!Device.isDevice || Platform.OS === 'web') return;
  const session = getSession();
  if (session.status !== 'signedIn') return;
  const stored = parseStoredPush(await AsyncStorage.getItem(PUSH_KEY));
  if (stored && stored.userId === session.user.id) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await registerForPush({ ask: false });
}

/** Forget local push registration (e.g. after 401 or session expiry so re-login re-registers). */
export async function clearLocalPushRegistration(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PUSH_KEY);
  } catch {
    // Ignore storage errors when clearing stale push state.
  }
}

/** This device's push token, forgotten locally (sign-out). The caller removes it from the account. */
export async function takePushToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_KEY);
    await AsyncStorage.removeItem(PUSH_KEY);
    return parseStoredPush(raw)?.token ?? null;
  } catch {
    return null;
  }
}

/** Remove a push token from the account the session belongs to (works after the local sign-out). */
export async function unregisterPushToken(pushToken: string, sessionToken: string): Promise<void> {
  await account.unregisterPush(pushToken, sessionToken);
}

/** Whether the system may still show its permission question (false after a hard "no"). */
export async function canAskForPush(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  return current.granted || current.canAskAgain;
}

export async function pushPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

/** The site link carried by a notification ("url" in the server's push payload). */
export function notificationLink(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  const link = data?.url ?? data?.link;
  return typeof link === 'string' ? link : null;
}
