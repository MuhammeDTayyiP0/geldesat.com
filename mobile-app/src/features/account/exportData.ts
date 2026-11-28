import { Alert, Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { timedFetch } from '@/api/client';
import { getToken } from '@/auth/session';
import { API_BASE_URL, webUrl } from '@/lib/config';

const SAFE_SHARE_BYTES = 250_000;

export async function exportAccountData(): Promise<void> {
  const token = getToken();
  if (!token) {
    await WebBrowser.openBrowserAsync(webUrl('/ayarlar/guvenlik'));
    return;
  }

  const res = await timedFetch(`${API_BASE_URL}/api/hesap/verilerim`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(
      body?.error ||
        (res.status === 429
          ? 'Çok sık indirme denediniz. Biraz sonra tekrar deneyin.'
          : 'Verileriniz hazırlanamadı.'),
    );
  }

  const text = await res.text();
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geldesat-verilerim.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    const file = new File(Paths.cache, 'geldesat-verilerim.json');
    file.create({ overwrite: true });
    await file.write(text);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Verilerimi kaydet',
    });
    return;
  }

  // Fallback for environments where file sharing is unavailable: Android Binder IPC rejects >~1MB share strings.
  if (text.length > SAFE_SHARE_BYTES) {
    Alert.alert(
      'Dosya boyutu büyük',
      'Verileriniz doğrudan paylaşım sınırı için büyük. Tarayıcıdan JSON dosyası olarak indirebilirsiniz.',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Tarayıcıda aç', onPress: () => void WebBrowser.openBrowserAsync(webUrl('/ayarlar/guvenlik')) },
      ],
    );
    return;
  }

  await Share.share({ title: 'geldesat-verilerim.json', message: text });
}
