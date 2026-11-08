import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { account } from '@/api/endpoints';

const PUSH_KEY = 'geldesat.pushToken.v1';

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
  await AsyncStorage.setItem(PUSH_KEY, token);
}

/**
 * Permission given later in the phone's settings: register then, without asking.
 * Called when the app returns to the foreground; does nothing once registered.
 */
export async function ensurePushRegistered(): Promise<void> {
  if (!Device.isDevice || Platform.OS === 'web') return;
  if (await AsyncStorage.getItem(PUSH_KEY)) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await registerForPush({ ask: false });
}

/** This device's push token, forgotten locally (sign-out). The caller removes it from the account. */
export async function takePushToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(PUSH_KEY);
    await AsyncStorage.removeItem(PUSH_KEY);
    return token;
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
  const current = await Notifications.getPermissionsAsync();
  return current.granted || current.canAskAgain;
}

export async function pushPermissionGranted(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** The site link carried by a notification ("url" in the server's push payload). */
export function notificationLink(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  const link = data?.url ?? data?.link;
  return typeof link === 'string' ? link : null;
}
