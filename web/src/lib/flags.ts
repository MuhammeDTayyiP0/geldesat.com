/**
 * Feature flags with staged rollout, shared by the website, the mobile config
 * endpoint and the admin panel. Pure code: no database, no React.
 *
 * Every person lands in a fixed bucket (0-99) per flag, computed from their id
 * and the flag name. A flag at 30% is on for buckets 0-29, so raising it to 50%
 * only adds people, and each flag splits people differently.
 */

export const FLAG_PLATFORMS = ["web", "ios", "android"] as const;
export type FlagPlatform = (typeof FLAG_PLATFORMS)[number];

export type FlagRule = {
  /** Master switch. Off means off for everyone, admins included (kill switch). */
  enabled: boolean;
  /** Share of people who get the flag, 0-100. */
  rollout: number;
  /** Platforms the flag runs on; empty means all of them. */
  platforms: FlagPlatform[];
  /** Lowest app version (1.2.3) that has the code; ignored on the website. */
  minAppVersion: string | null;
  /** Admin accounts always get the flag (still subject to platform and version). */
  admins: boolean;
  /** What the flag does, for the admin panel. */
  description: string;
};

export type FlagRules = Record<string, FlagRule>;

export type FlagContext = {
  /** Account id when signed in, otherwise a device / browser id. */
  unitId: string;
  platform: FlagPlatform;
  appVersion?: string | null;
  isAdmin?: boolean;
};

export const FLAG_NAME_PATTERN = /^[a-z0-9_]{1,60}$/;
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function fullRule(enabled: boolean, description = ""): FlagRule {
  return { enabled, rollout: 100, platforms: [], minAppVersion: null, admins: false, description };
}

/**
 * Stored flags, tolerating the old `{ name: true }` format and partial or
 * malformed entries (which become fully-off rules instead of throwing).
 */
export function normalizeFlags(raw: unknown): FlagRules {
  const out: FlagRules = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!FLAG_NAME_PATTERN.test(name)) continue;
    if (typeof value === "boolean") {
      out[name] = fullRule(value);
      continue;
    }
    if (!value || typeof value !== "object") continue;
    const v = value as Partial<Record<keyof FlagRule, unknown>>;
    const rollout = typeof v.rollout === "number" && Number.isFinite(v.rollout) ? Math.round(v.rollout) : 100;
    out[name] = {
      enabled: v.enabled === true,
      rollout: Math.min(100, Math.max(0, rollout)),
      platforms: Array.isArray(v.platforms)
        ? FLAG_PLATFORMS.filter((p) => (v.platforms as unknown[]).includes(p))
        : [],
      minAppVersion: typeof v.minAppVersion === "string" && VERSION_PATTERN.test(v.minAppVersion) ? v.minAppVersion : null,
      admins: v.admins === true,
      description: typeof v.description === "string" ? v.description.slice(0, 200) : "",
    };
  }
  return out;
}

/** Stable 0-99 bucket for one person and one flag (32-bit FNV-1a). */
export function flagBucket(name: string, unitId: string): number {
  const seed = `${name}:${unitId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}

/** -1, 0 or 1 for dotted numeric versions ("1.10.0" > "1.9.3"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function isFlagOn(name: string, rule: FlagRule | undefined, ctx: FlagContext): boolean {
  if (!rule?.enabled) return false;
  if (rule.platforms.length && !rule.platforms.includes(ctx.platform)) return false;
  if (rule.minAppVersion && ctx.platform !== "web") {
    if (!ctx.appVersion || compareVersions(ctx.appVersion, rule.minAppVersion) < 0) return false;
  }
  if (rule.admins && ctx.isAdmin) return true;
  if (rule.rollout >= 100) return true;
  if (rule.rollout <= 0) return false;
  return flagBucket(name, ctx.unitId) < rule.rollout;
}

/** On/off for every flag, as the apps receive them. */
export function evaluateFlags(rules: FlagRules, ctx: FlagContext): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [name, rule] of Object.entries(rules)) out[name] = isFlagOn(name, rule, ctx);
  return out;
}
