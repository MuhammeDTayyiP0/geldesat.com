import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL, SITE_URL } from '@/lib/config';
import { ApiError, NETWORK_ERROR, request } from '@/api/client';
import { clearSession, getToken, loadStoredSession, saveSession, setSignedIn, setSignedOut, type SessionUser } from './session';

const OAUTH_REDIRECT = 'geldesat://oauth';

type AuthBody = {
  token?: string | null;
  user?: { id: string; email: string; name?: string | null };
  message?: string;
  code?: string;
};

/** Better Auth checks Origin on state-changing calls; the site origin is trusted. */
const originHeaders = { Origin: SITE_URL, Referer: `${SITE_URL}/` };

async function authPost(path: string, body: unknown): Promise<{ data: AuthBody; token: string | null; status: number }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...originHeaders },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }
  const data = ((await response.json().catch(() => ({}))) ?? {}) as AuthBody;
  if (!response.ok) throw new ApiError(translateAuthError(data, response.status), response.status);
  return { data, token: response.headers.get('set-auth-token') || data.token || null, status: response.status };
}

function translateAuthError(data: AuthBody, status: number): string {
  const code = data.code ?? '';
  const message = data.message ?? '';
  if (code === 'INVALID_EMAIL_OR_PASSWORD' || /invalid email or password/i.test(message)) return 'E-posta adresi veya şifre hatalı.';
  if (code.startsWith('USER_ALREADY_EXISTS') || /already exists/i.test(message)) return 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.';
  if (code === 'PASSWORD_TOO_SHORT') return 'Şifre en az 8 karakter olmalı.';
  if (code === 'PASSWORD_TOO_LONG') return 'Şifre çok uzun.';
  if (code === 'INVALID_EMAIL') return 'Geçerli bir e-posta adresi girin.';
  if (code === 'EMAIL_NOT_VERIFIED') return 'E-posta adresinizi doğrulayın. Size gönderdiğimiz bağlantıya tıklayın.';
  if (code === 'INVALID_PASSWORD') return 'Mevcut şifreniz hatalı.';
  if (status === 429) return 'Çok fazla deneme yaptınız. Lütfen biraz bekleyin.';
  if (message && /[ğüşıöçĞÜŞİÖÇ]/.test(message)) return message; // already Turkish (e.g. suspended account)
  return status >= 500 ? 'Sunucu şu an yanıt veremiyor. Lütfen tekrar deneyin.' : 'İşlem tamamlanamadı. Bilgilerinizi kontrol edin.';
}

function toUser(user: NonNullable<AuthBody['user']>, fallbackName = ''): SessionUser {
  return { id: user.id, email: user.email, name: user.name || fallbackName || user.email.split('@')[0] };
}

export async function signInWithEmail(email: string, password: string): Promise<SessionUser> {
  const { data, token } = await authPost('/sign-in/email', { email: email.trim().toLowerCase(), password });
  if (!data.user || !token) throw new ApiError('Oturum açılamadı. Lütfen tekrar deneyin.', 500);
  const user = toUser(data.user);
  await saveSession(user, token);
  return user;
}

/** Returns the user when signed in at once, or null when the address must be verified first. */
export async function signUpWithEmail(name: string, email: string, password: string): Promise<SessionUser | null> {
  const { data, token } = await authPost('/sign-up/email', {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    callbackURL: `${SITE_URL}/`,
  });
  if (!data.user) throw new ApiError('Kayıt tamamlanamadı.', 500);
  if (!token) return null;
  const user = toUser(data.user, name);
  await saveSession(user, token);
  return user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await authPost('/request-password-reset', {
    email: email.trim().toLowerCase(),
    redirectTo: `${SITE_URL}/sifre-sifirla`,
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...originHeaders },
      body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }
  const data = ((await response.json().catch(() => ({}))) ?? {}) as AuthBody;
  if (!response.ok) throw new ApiError(translateAuthError(data, response.status), response.status);
  // Revoking other sessions issues a fresh token for this one.
  const next = response.headers.get('set-auth-token') || data.token;
  const session = await loadStoredSession();
  if (next && session) await saveSession(session.user, next);
}

export async function sendVerificationEmail(email: string): Promise<void> {
  await authPost('/send-verification-email', { email, callbackURL: `${SITE_URL}/` });
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Google sign-in in the system auth browser, PKCE style (see
 * web/src/lib/server/mobile-oauth.ts): only a one-time code comes back to the
 * app, and only this app knows the verifier that redeems it.
 * Resolves null if the person closed the browser.
 */
export async function signInWithGoogle(): Promise<SessionUser | null> {
  const verifier = base64Url(Crypto.getRandomBytes(48));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const result = await WebBrowser.openAuthSessionAsync(
    `${SITE_URL}/api/mobile/oauth/start?challenge=${challenge}`,
    OAUTH_REDIRECT,
    { preferEphemeralSession: true },
  );
  if (result.type !== 'success') return null;
  const code = Linking.parse(result.url).queryParams?.code;
  if (typeof code !== 'string' || !code) throw new ApiError('Google ile giriş tamamlanamadı.', 400);
  const res = await request<{ token: string; user: { id: string; email: string; name: string } }>('/api/mobile/oauth/exchange', {
    method: 'POST',
    body: { code, verifier },
    auth: false,
  });
  const user = toUser(res.user);
  await saveSession(user, res.token);
  return user;
}

/** On launch: trust a stored session only after the server confirms it (keep it while offline). */
export async function restoreSession(): Promise<void> {
  const stored = await loadStoredSession();
  if (!stored) {
    setSignedOut();
    return;
  }
  setSignedIn(stored.user, stored.token);
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${stored.token}`, Accept: 'application/json' },
    });
    if (!response.ok) return;
    const data = (await response.json().catch(() => null)) as { user?: AuthBody['user'] } | null;
    if (!data?.user?.id) {
      await clearSession();
      return;
    }
    await saveSession(toUser(data.user, stored.user.name), stored.token);
  } catch {
    // Offline: keep the stored session; the next API 401 signs out.
  }
}

export async function signOut(beforeClear?: () => Promise<void>): Promise<void> {
  const token = getToken();
  try {
    await beforeClear?.();
  } catch {
    // Best effort.
  }
  if (token) {
    await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...originHeaders },
      body: '{}',
    }).catch(() => undefined);
  }
  await clearSession();
}
