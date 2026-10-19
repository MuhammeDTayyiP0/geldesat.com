/**
 * Content-Security-Policy for server-rendered pages. Scripts must come from this
 * site or carry the per-request nonce that TanStack Router stamps on its own
 * inline scripts.
 * Inline styles stay allowed: React `style` props and the critical CSS need them.
 */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    // Listing photos can be legacy external URLs; Google avatars come from googleusercontent.
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "frame-src https://www.openstreetmap.org",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
