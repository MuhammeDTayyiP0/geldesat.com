/** Short-lived client cache for admin layout beforeLoad checks. */
const ADMIN_SESSION_TTL_MS = 30_000;
let confirmedAt = 0;
let confirmedUserId: string | null = null;

export function shouldUseAdminSessionCache(userId?: string | null): boolean {
  if (confirmedAt <= 0 || Date.now() - confirmedAt >= ADMIN_SESSION_TTL_MS) return false;
  if (userId !== undefined && confirmedUserId !== (userId ?? null)) return false;
  return true;
}

export function markAdminSessionConfirmed(userId?: string | null): void {
  confirmedAt = Date.now();
  if (userId !== undefined) confirmedUserId = userId ?? null;
}

export function resetAdminSessionCache(): void {
  confirmedAt = 0;
  confirmedUserId = null;
}
