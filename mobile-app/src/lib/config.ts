import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** The GeldeSat site (app.json → extra.apiBaseUrl): share links, auth callback URLs. */
export const SITE_URL: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ?? 'https://www.geldesat.com';

/**
 * Where API requests go. In a development browser session the app calls its
 * own origin and metro.config.js forwards /api/* to the site (no CORS);
 * native builds call the site directly.
 */
export const API_BASE_URL: string =
  Platform.OS === 'web' && __DEV__ && typeof window !== 'undefined' ? window.location.origin : SITE_URL;

export const SITE_HOSTS = ['www.geldesat.com', 'geldesat.com'];

export const SUPPORT_EMAIL = 'destek@geldesat.com';

export type PhotoWidth = 240 | 480 | 800 | 1200;

/**
 * Absolute URL for an image path the API returns ("/uploads/…", "/api/mobile/images/…").
 * Stored listing photos come in server-resized WebP widths (see web/src/lib/images.ts).
 */
export function mediaUrl(path: string | null | undefined, width?: PhotoWidth): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('file:')) return path;
  const stored = path.startsWith('/uploads/') || path.startsWith('/api/mobile/images/');
  const sized = width && stored && !path.includes('?') ? `${path}?w=${width}` : path;
  return `${API_BASE_URL}${sized.startsWith('/') ? '' : '/'}${sized}`;
}

export function webUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
