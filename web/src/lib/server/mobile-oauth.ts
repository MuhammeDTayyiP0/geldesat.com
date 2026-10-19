import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Google sign-in for the native app, PKCE style. The app opens
 * /api/mobile/oauth/start with sha256(verifier) as `challenge`; after Google,
 * /api/mobile/oauth/done parks the new session token under a one-time code and
 * sends only that code back to the app, which trades it (with the verifier)
 * at /api/mobile/oauth/exchange. Another app catching the `geldesat://` link
 * gets a code it cannot use.
 */

const TTL_MS = 5 * 60_000;
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;

type Pending = { challenge: string; token: string; expiresAt: number };

const globalRef = globalThis as typeof globalThis & { __geldesatMobileOauth__?: Map<string, Pending> };
const pending = (globalRef.__geldesatMobileOauth__ ??= new Map());

export const MOBILE_OAUTH_REDIRECT = "geldesat://oauth";

export function isChallenge(value: string | null): value is string {
  return Boolean(value && CHALLENGE_RE.test(value));
}

function prune(now: number) {
  for (const [code, entry] of pending) if (entry.expiresAt < now) pending.delete(code);
}

/** Park a session token for the app; returns the one-time code. */
export function parkToken(challenge: string, token: string): string {
  const now = Date.now();
  prune(now);
  const code = randomBytes(24).toString("base64url");
  pending.set(code, { challenge, token, expiresAt: now + TTL_MS });
  return code;
}

/** The parked token if `verifier` matches the code's challenge; the code is spent either way. */
export function redeemCode(code: string, verifier: string): string | null {
  const entry = pending.get(code);
  pending.delete(code);
  if (!entry || entry.expiresAt < Date.now()) return null;
  const hashed = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(entry.challenge);
  if (hashed.length !== expected.length || !timingSafeEqual(hashed, expected)) return null;
  return entry.token;
}
