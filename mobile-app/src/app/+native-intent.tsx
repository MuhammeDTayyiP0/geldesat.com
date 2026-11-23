import type { Href } from 'expo-router';
import { appRouteForWebPath } from '@/lib/links';

function serializeHref(href: Href): string {
  if (typeof href === 'string') return href;
  let pathname: string = href.pathname;
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(href.params ?? {})) {
    if (raw === undefined || raw === null) continue;
    const picked = Array.isArray(raw) ? raw[0] : raw;
    if (picked === undefined || picked === null) continue;
    const value = String(picked);
    const token = `[${key}]`;
    if (pathname.includes(token)) {
      pathname = pathname.replace(token, encodeURIComponent(value));
    } else {
      query.set(key, value);
    }
  }
  const qs = query.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Map incoming universal links and `geldesat://` deep links to Expo Router paths. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const trimmed = path.trim();
    if (!trimmed) return path;

    let candidate = trimmed;
    if (/^geldesat:\/\//i.test(candidate)) {
      candidate = candidate.replace(/^geldesat:\/\//i, '');
      if (!candidate.startsWith('/')) candidate = `/${candidate}`;
    }

    if (/^\/oauth(?:[/?#]|$)/i.test(candidate)) return path;

    const route = appRouteForWebPath(candidate);
    if (!route) return path;
    return serializeHref(route);
  } catch {
    return path;
  }
}
