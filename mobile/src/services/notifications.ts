import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

    const pushTokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    token = pushTokenData?.data || null;
  } catch {
    // Simülatör veya izin reddi durumunda sessizce devam et
  }

  return token;
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
  } catch {}
}
