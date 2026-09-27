import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './client';

export interface MobileUser {
  id: string;
  email: string;
  name: string;
  token?: string;
}

const USER_STORAGE_KEY = 'geldesat_mobile_user';
const TOKEN_STORAGE_KEY = 'geldesat_mobile_token';

/**
 * Cihazın güvenli anahtarlığında (Keychain/Keystore) kayıtlı kullanıcıyı okur.
 */
export async function getStoredUser(): Promise<MobileUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Kullanıcıyı güvenli anahtarlığa kaydeder.
 */
export async function setStoredUser(user: MobileUser | null): Promise<void> {
  try {
    if (!user) {
      await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    } else {
      await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(user));
      if (user.token) {
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, user.token);
      }
    }
  } catch {}
}

/**
 * E-posta ve şifre ile giriş yapar.
 * Better Auth CSRF koruması için Origin ve Referer başlıkları eklenir.
 */
export async function mobileSignIn(
  email: string,
  password: string
): Promise<{ success: boolean; user?: MobileUser; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': API_BASE_URL,
        'Referer': `${API_BASE_URL}/`,
      },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.user) {
      const user: MobileUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || email.split('@')[0],
        token: data.token || data.session?.token,
      };
      await setStoredUser(user);
      return { success: true, user };
    } else {
      let errorMsg = data?.message || 'Giriş yapılamadı.';
      if (
        errorMsg === 'Invalid email or password' ||
        data?.code === 'INVALID_EMAIL_OR_PASSWORD'
      ) {
        errorMsg = 'E-posta adresi veya şifre hatalı.';
      } else if (errorMsg.includes('Origin') || errorMsg.includes('origin')) {
        errorMsg = 'Güvenlik doğrulaması başarısız oldu. Lütfen tekrar deneyin.';
      }
      return { success: false, error: errorMsg };
    }
  } catch (err: any) {
    return {
      success: false,
      error: 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.',
    };
  }
}

/**
 * Yeni hesap oluşturur.
 * Better Auth CSRF koruması için Origin ve Referer başlıkları eklenir.
 */
export async function mobileSignUp(
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; user?: MobileUser; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': API_BASE_URL,
        'Referer': `${API_BASE_URL}/`,
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.user) {
      const user: MobileUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || name,
        token: data.token,
      };
      await setStoredUser(user);
      return { success: true, user };
    } else {
      let errorMsg = data?.message || 'Kayıt işlemi tamamlanamadı.';
      if (
        errorMsg.includes('already exists') ||
        data?.code === 'USER_ALREADY_EXISTS'
      ) {
        errorMsg = 'Bu e-posta adresi ile zaten kayıtlı bir hesap bulunmaktadır.';
      } else if (
        errorMsg.includes('password') ||
        data?.code === 'PASSWORD_TOO_SHORT'
      ) {
        errorMsg = 'Şifre en az 6 karakter olmalıdır.';
      } else if (errorMsg.includes('Origin') || errorMsg.includes('origin')) {
        errorMsg = 'Güvenlik doğrulaması başarısız oldu. Lütfen tekrar deneyin.';
      }
      return { success: false, error: errorMsg };
    }
  } catch (err: any) {
    return {
      success: false,
      error: 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.',
    };
  }
}

/**
 * Güvenli çıkış yapar.
 */
export async function mobileSignOut(): Promise<void> {
  try {
    const user = await getStoredUser();
    if (user?.token) {
      await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': API_BASE_URL,
          'Authorization': `Bearer ${user.token}`,
        },
      }).catch(() => {});
    }
  } catch {}
  await setStoredUser(null);
}
