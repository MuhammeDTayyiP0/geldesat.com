/**
 * One place for what may happen to a listing, used by the web and app APIs and
 * by the screens that offer the actions. Pure, so it also runs in the browser.
 */

export type ListingStatus = "ACTIVE" | "INACTIVE" | "SOLD" | "PENDING" | "REJECTED";
export type OwnerAction = "edit" | "publish" | "hide" | "sold" | "renew" | "delete";

export type ListingState = { status: string; approved: boolean; expired: boolean };

/** A listing visitors can see in catalog pages and contact: SQL for alias `l` by default. */
export function liveSql(alias = "l"): string {
  return `${alias}.status = 'ACTIVE' and (${alias}.expires_at is null or ${alias}.expires_at > now())`;
}

export function isExpired(expiresAt: string | Date | null | undefined, now = Date.now()): boolean {
  return Boolean(expiresAt) && new Date(expiresAt as string | Date).getTime() <= now;
}

/** Why an owner cannot put this listing live, or null when they can. */
export function publishBlock({ status, approved, expired }: ListingState): string | null {
  if (status === "ACTIVE" && !expired) return "İlan zaten yayında.";
  if (status === "PENDING" || status === "REJECTED" || !approved) return "Onay bekleyen ilanı siz yayına alamazsınız.";
  if (expired) return "İlanın süresi dolmuş. Önce süresini uzatın.";
  return null;
}

/** The actions to offer the owner, in menu order. */
export function ownerActions(state: ListingState): OwnerAction[] {
  const { status, expired } = state;
  const actions: OwnerAction[] = ["edit"];
  if (!publishBlock(state)) actions.push("publish");
  if (status === "ACTIVE" && !expired) actions.push("hide");
  if (status === "ACTIVE" || status === "INACTIVE") actions.push("sold", "renew");
  if (status === "PENDING") actions.push("renew");
  actions.push("delete");
  return actions;
}

/** Checks an owner's own status change; moderation states belong to admins. */
export function assertOwnerStatus(next: string, state: ListingState): void {
  if (next === "ACTIVE") {
    const block = publishBlock(state);
    if (block) throw new Error(block);
    return;
  }
  if (next === "INACTIVE" || next === "SOLD") {
    if (state.status === "PENDING" || state.status === "REJECTED") throw new Error("Onay bekleyen ilanın durumu değiştirilemez.");
    return;
  }
  throw new Error("Yetkisiz işlem");
}

/** Renewing extends the time and never changes visibility: a hidden listing stays hidden. */
export function assertRenewable(status: string): void {
  if (status === "REJECTED") throw new Error("Reddedilen ilan yenilenemez.");
  if (status === "SOLD") throw new Error("Satılan ilanın süresi uzatılamaz.");
}

/** Editing what a listing shows sends it back to review, whatever state it is in. */
export function needsReReview(status: string): boolean {
  return status === "ACTIVE" || status === "INACTIVE" || status === "SOLD";
}

/** Order-independent comparison of attribute values, to notice edits. */
export function sameAttrs(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const norm = (x: Record<string, unknown>) =>
    JSON.stringify(Object.keys(x).sort().map((k) => [k, String(x[k])]));
  return norm(a) === norm(b);
}
