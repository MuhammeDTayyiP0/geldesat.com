import type { Href } from 'expo-router';
import { SITE_HOSTS } from './config';

/**
 * Map a website path (notification links, shared URLs) to the app screen
 * that shows the same thing. Unknown paths return null.
 */
/** decodeURIComponent that leaves a malformed piece ("%E0%A4%A") as it is instead of throwing. */
function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

const SETTINGS_PAGES = new Set(['profil', 'guvenlik', 'gizlilik', 'bildirimler', 'engellenenler', 'magaza', 'gorunum']);

export function appRouteForWebPath(path: string): Href | null {
  let clean = path.trim();
  if (/^https?:\/\//i.test(clean)) {
    const match = clean.match(/^https?:\/\/([^/]+)(\/[^#]*)?/i);
    if (!match || !SITE_HOSTS.includes(match[1].toLowerCase())) return null;
    clean = match[2] || '/';
  }
  const [pathOnly, queryString = ''] = clean.split('#')[0].split('?');
  const query = new URLSearchParams(queryString);
  const parts = (pathOnly ?? '/').split('/').filter(Boolean).map(decode);
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
    case 'search': {
      // The site's search filters that the results screen understands.
      const params: Record<string, string> = {};
      for (const key of ['q', 'category', 'city', 'district', 'sort']) {
        const value = query.get(key);
        if (value) params[key] = value;
      }
      return { pathname: '/sonuclar', params };
    }
    case 'son-bakilanlar':
      return '/son-bakilanlar';
    case 'ayarlar':
      if (second === 'hesap') return '/ayarlar/guvenlik';
      return second && SETTINGS_PAGES.has(second) ? (`/ayarlar/${second}` as Href) : ('/ayarlar' as Href);
    case 'profil':
      return '/hesap';
    default:
      return null;
  }
}
