/**
 * Baseline security headers on every response (pages, API, sitemaps, images).
 *
 * The CSP here is the fallback for non-page responses. Server-rendered pages get
 * the full nonce-based policy from src/router.tsx, which this middleware keeps.
 */

interface HeaderEvent {
  url?: URL;
  req?: { headers?: Headers };
  res?: { headers?: Headers };
}

const BASE_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)",
  "Content-Security-Policy": "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

function securityHeaders(event: HeaderEvent): Record<string, string> {
  const proto = event.req?.headers?.get("x-forwarded-proto") ?? event.url?.protocol.replace(":", "");
  return proto === "https"
    ? { ...BASE_HEADERS, "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
    : BASE_HEADERS;
}

export default async function securityHeadersMiddleware(
  event: HeaderEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const headers = securityHeaders(event);
  // Headers for responses h3 builds from plain values.
  for (const [name, value] of Object.entries(headers)) event.res?.headers?.set(name, value);

  const result = await next();
  if (!(result instanceof Response)) return result;
  try {
    for (const [name, value] of Object.entries(headers)) {
      if (!result.headers.has(name)) result.headers.set(name, value);
    }
    return result;
  } catch {
    // Immutable headers (e.g. a proxied fetch response): copy into a new Response.
    const copy = new Response(result.body, result);
    for (const [name, value] of Object.entries(headers)) {
      if (!copy.headers.has(name)) copy.headers.set(name, value);
    }
    return copy;
  }
}
