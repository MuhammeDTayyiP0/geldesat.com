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
export async function registerForPush(): Promise<void> {
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
  if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await account.registerPush(token);
  await AsyncStorage.setItem(PUSH_KEY, token);
}

/** Remove this device from the account before signing out. */
export async function unregisterPush(): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_KEY);
  if (!token) return;
  await account.unregisterPush(token).catch(() => undefined);
  await AsyncStorage.removeItem(PUSH_KEY);
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
