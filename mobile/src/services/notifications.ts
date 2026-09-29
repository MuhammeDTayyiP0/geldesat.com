import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const PUSH_TOKEN_KEY = 'geldesat_mobile_push_token';

// Bildirimlerin uygulama açıkken nasıl görüneceğini ayarla
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Kullanıcıdan anlık bildirim izni ister ve Expo Push Token'ı döndürür.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Android için bildirim kanalı oluştur
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'GeldeSat Bildirimleri',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1a4fd8',
      });
    }

    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    const pushTokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined).catch(() => null);
    token = pushTokenData?.data || null;
    if (token) await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  } catch {
    // Simülatör veya izin reddi durumunda sessizce devam et
  }

  return token;
}

export async function getRegisteredPushToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(PUSH_TOKEN_KEY); } catch { return null; }
}

export async function clearRegisteredPushToken(): Promise<void> {
  try { await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY); } catch { /* Best-effort local cleanup. */ }
}

export function addNotificationTapListener(onLink: (link: string) => void) {
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    const link = response?.notification.request.content.data?.link;
    if (typeof link === 'string') onLink(link);
  }).catch(() => { /* No cold-start notification response is expected. */ });
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const link = response.notification.request.content.data?.link;
    if (typeof link === 'string') onLink(link);
  });
  return () => subscription.remove();
}

/**
 * Yerel test bildirimi gönderir (Örn: Fiyat düştü bildirimi).
 */
export async function sendLocalNotification(title: string, body: string, data: Record<string, any> = {}) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Hemen gönder
    });
  } catch { /* Local notification failure does not block the app. */ }
}
