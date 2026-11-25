/** Short-lived client cache for admin layout beforeLoad checks. */
const ADMIN_SESSION_TTL_MS = 30_000;
let confirmedAt = 0;

export function shouldUseAdminSessionCache(): boolean {
  return confirmedAt > 0 && Date.now() - confirmedAt < ADMIN_SESSION_TTL_MS;
}

export function markAdminSessionConfirmed(): void {
  confirmedAt = Date.now();
}

export function resetAdminSessionCache(): void {
  confirmedAt = 0;
}
