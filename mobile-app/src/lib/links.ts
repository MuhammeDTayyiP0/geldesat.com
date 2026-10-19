import type { Href } from 'expo-router';
import { SITE_HOSTS } from './config';

/**
 * Map a website path (notification links, shared URLs) to the app screen
 * that shows the same thing. Unknown paths return null.
 */
export function appRouteForWebPath(path: string): Href | null {
  let clean = path.trim();
  if (/^https?:\/\//i.test(clean)) {
    const match = clean.match(/^https?:\/\/([^/]+)(\/[^?#]*)?/i);
    if (!match || !SITE_HOSTS.includes(match[1].toLowerCase())) return null;
    clean = match[2] || '/';
  }
  clean = clean.split(/[?#]/)[0] ?? '/';
  const parts = clean.split('/').filter(Boolean).map(decodeURIComponent);
  const [head, second] = parts;
  switch (head) {
    case undefined:
      return '/';
    case 'ilan':
      return second ? { pathname: '/ilan/[id]', params: { id: second } } : null;
    case 'mesajlar':
      return second ? { pathname: '/mesaj/[id]', params: { id: second } } : '/mesajlar';
    case 'ilanlarim':
      return '/ilanlarim';
    case 'favoriler':
      return '/favoriler';
    case 'bildirimler':
      return '/bildirimler';
    case 'satici':
      return second ? { pathname: '/satici/[id]', params: { id: second } } : null;
    case 'magaza':
      return second ? { pathname: '/magaza/[slug]', params: { slug: second } } : null;
    case 'category':
      return second ? { pathname: '/sonuclar', params: { category: second } } : null;
    case 'sayfa':
      return second ? { pathname: '/sayfa/[slug]', params: { slug: second } } : null;
    case 'ilan-ver':
      return '/ilan-ver';
    case 'doping':
      return '/doping';
    case 'search':
      return '/sonuclar';
    case 'profil':
    case 'ayarlar':
      return '/hesap';
    default:
      return null;
  }
}
