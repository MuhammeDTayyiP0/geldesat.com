import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { asJson } from "@/lib/utils";
import { evaluateFlags, fullRule, normalizeFlags, type FlagPlatform, type FlagRules } from "@/lib/flags";

/** Flags a fresh database starts with (the admin panel stores the real set under `features`). */
export const DEFAULT_FLAGS: FlagRules = {
  doping_enabled: fullRule(true, "Doping / vitrin satışı ekranları."),
  mobile_bottom_nav: fullRule(true, "Mobil uygulamada alt gezinme çubuğu."),
};

/** Get a config value from the database. */
export async function getAppConfig<T>(key: string, fallback: T): Promise<T> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ value: unknown }>(
      "select value from app_config where key = $1",
      [key],
    );
    if (!rows.length || rows[0].value === undefined) return fallback;
    return asJson<T>(rows[0].value, fallback);
  } catch (err) {
    console.error(`[app_config] Failed to get key ${key}:`, err);
    return fallback;
  }
}

/** Save or update a config value in the database. */
export async function setAppConfig<T>(key: string, value: T): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into app_config (key, value, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key) do update
     set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
  if (key === "features") flagCache = null;
}

/* ───────────────────────────── Feature flags ───────────────────────────── */

// Every app open and page render reads the flags; a short cache keeps that off
// the database. Saving in the admin panel clears it (single server process).
const FLAG_TTL_MS = 15_000;
let flagCache: { rules: FlagRules; at: number } | null = null;

export async function loadFlagRules(): Promise<FlagRules> {
  if (flagCache && Date.now() - flagCache.at < FLAG_TTL_MS) return flagCache.rules;
  const raw = await getAppConfig<unknown>("features", DEFAULT_FLAGS);
  const rules = normalizeFlags(raw);
  flagCache = { rules, at: Date.now() };
  return rules;
}

async function isAdminAccount(userId: string): Promise<boolean> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ role: string }>("select role from profiles where user_id = $1", [userId]);
    return rows[0]?.role === "ADMIN";
  } catch {
    return false;
  }
}

export type FlagRequest = {
  userId: string | null;
  /** Device id (app) or browser cookie id (web), used before sign-in. */
  anonId: string | null;
  platform: FlagPlatform;
  appVersion?: string | null;
};

/** The on/off flags one person gets. Never throws: on errors every flag is off. */
export async function resolveFlags(req: FlagRequest): Promise<Record<string, boolean>> {
  try {
    const rules = await loadFlagRules();
    const needsRole = Boolean(req.userId) && Object.values(rules).some((r) => r.enabled && r.admins);
    const isAdmin = needsRole && req.userId ? await isAdminAccount(req.userId) : false;
    return evaluateFlags(rules, {
      unitId: req.userId ?? req.anonId ?? "guest",
      platform: req.platform,
      appVersion: req.appVersion ?? null,
      isAdmin,
    });
  } catch (err) {
    console.error("[flags] resolve failed:", err);
    return {};
  }
}

/* ───────────────────────────── Website flags ───────────────────────────── */

const ANON_COOKIE = "gs-uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Flags for the current website visitor. Signed-out visitors get a random id
 * cookie so their rollout bucket stays the same between visits.
 */
export const getWebFlags = createServerFn({ method: "GET" }).handler(async (): Promise<Record<string, boolean>> => {
  const { getCookie, setCookie } = await import("@tanstack/react-start/server");
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  let anonId = getCookie(ANON_COOKIE) ?? null;
  if (!anonId || !/^[a-z0-9-]{8,64}$/i.test(anonId)) {
    anonId = crypto.randomUUID();
    setCookie(ANON_COOKIE, anonId, {
      path: "/",
      maxAge: ONE_YEAR,
      httpOnly: true,
      sameSite: "lax",
      secure: import.meta.env.PROD,
    });
  }
  const user = await getSessionUser().catch(() => null);
  return resolveFlags({ userId: user?.id ?? null, anonId, platform: "web" });
});
