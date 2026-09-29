import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './client';
import { clearRegisteredPushToken, getRegisteredPushToken } from '../services/notifications';

export interface MobileUser {
  id: string;
  email: string;
  name: string;
  token?: string;
}

const USER_STORAGE_KEY = 'geldesat_mobile_user';
const TOKEN_STORAGE_KEY = 'geldesat_mobile_token';
let storedUserCache: MobileUser | null | undefined;
let storedUserRead: Promise<MobileUser | null> | null = null;

/**
 * Cihazın güvenli anahtarlığında (Keychain/Keystore) kayıtlı kullanıcıyı okur.
 */
export async function getStoredUser(): Promise<MobileUser | null> {
  if (storedUserCache !== undefined) return storedUserCache;
  if (storedUserRead) return storedUserRead;
  storedUserRead = (async () => {
  try {
    const raw = await SecureStore.getItemAsync(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MobileUser;
  } catch {
    return null;
  }
  })();
  storedUserCache = await storedUserRead;
  storedUserRead = null;
  return storedUserCache;
}

/** Validate a saved mobile token against Better Auth before trusting its user. */
export async function validateMobileSession(token: string): Promise<MobileUser | null> {
  const response = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  if (!data?.user?.id) return null;
  return {
    id: String(data.user.id),
    email: String(data.user.email || ''),
    name: String(data.user.name || data.user.email?.split('@')[0] || 'GeldeSat üyesi'),
    token,
  };
}

/** Restore only a session confirmed by the server. Keep it on transient network errors. */
export async function restoreMobileSession(): Promise<MobileUser | null> {
  const stored = await getStoredUser();
  if (!stored) return null;
  if (!stored.token) {
    await setStoredUser(null);
    return null;
  }
  try {
    const verified = await validateMobileSession(stored.token);
    if (!verified) {
      await setStoredUser(null);
      return null;
    }
    await setStoredUser(verified);
    return verified;
  } catch {
    return stored;
  }
}

/**
 * Kullanıcıyı güvenli anahtarlığa kaydeder.
 */
export async function setStoredUser(user: MobileUser | null): Promise<void> {
  storedUserCache = user;
  storedUserRead = null;
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
  } catch { /* SecureStore can be unavailable on web; server auth still fails closed. */ }
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

    const sessionToken = data?.token || data?.session?.token;
    if (res.ok && data?.user?.id && sessionToken) {
      const user: MobileUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || email.split('@')[0],
        token: sessionToken,
      };
      await setStoredUser(user);
      return { success: true, user };
    } else {
      let errorMsg = data?.message || (res.ok ? 'Güvenli oturum oluşturulamadı. Lütfen tekrar deneyin.' : 'Giriş yapılamadı.');
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
  } catch {
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

    const sessionToken = data?.token || data?.session?.token;
    if (res.ok && data?.user?.id && sessionToken) {
      const user: MobileUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || name,
        token: sessionToken,
      };
      await setStoredUser(user);
      return { success: true, user };
    } else {
      let errorMsg = data?.message || (res.ok ? 'Güvenli oturum oluşturulamadı. Lütfen tekrar deneyin.' : 'Kayıt işlemi tamamlanamadı.');
      if (
        errorMsg.includes('already exists') ||
        data?.code === 'USER_ALREADY_EXISTS'
      ) {
        errorMsg = 'Bu e-posta adresi ile zaten kayıtlı bir hesap bulunmaktadır.';
      } else if (
        errorMsg.includes('password') ||
        data?.code === 'PASSWORD_TOO_SHORT'
      ) {
        errorMsg = 'Şifre en az 8 karakter olmalıdır.';
      } else if (errorMsg.includes('Origin') || errorMsg.includes('origin')) {
        errorMsg = 'Güvenlik doğrulaması başarısız oldu. Lütfen tekrar deneyin.';
      }
      return { success: false, error: errorMsg };
    }
  } catch {
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
      const pushToken = await getRegisteredPushToken();
      if (pushToken) {
        await fetch(`${API_BASE_URL}/api/mobile/notifications`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unregister-push', token: pushToken }),
        }).catch(() => {});
      }
      await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': API_BASE_URL,
          'Authorization': `Bearer ${user.token}`,
        },
      }).catch(() => {});
    }
  } catch { /* Logout must still clear local session state. */ }
  await clearRegisteredPushToken();
  await setStoredUser(null);
}
