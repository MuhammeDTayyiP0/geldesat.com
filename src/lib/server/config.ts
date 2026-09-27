import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { asJson } from "@/lib/utils";

export interface ClientAppConfig {
  homeSections: string[];
  features: Record<string, boolean>;
  mobileApp: {
    minIosVersion?: string;
    minAndroidVersion?: string;
    announcement?: string | null;
  };
}

const DEFAULT_CONFIG: ClientAppConfig = {
  homeSections: ["hero", "categories", "featured", "recent", "stats"],
  features: {
    ab_testing: true,
    doping_enabled: true,
    mobile_bottom_nav: true,
  },
  mobileApp: {
    minIosVersion: "1.0.0",
    minAndroidVersion: "1.0.0",
    announcement: null,
  },
};

/**
 * Deterministic A/B test variant assignment using hashing.
 * 0 TL cost: completely in-memory, reproducible, no external service.
 */
export function calculateVariant(testName: string, userId: string, variants: string[] = ["A", "B"]): string {
  if (!variants.length) return "A";
  const seed = `${testName}:${userId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % variants.length;
  return variants[index];
}

/** Get a config value from the database with in-memory caching. */
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
}

/**
 * Server function providing config and feature flags to both Web and Mobile apps.
 */
export const getClientConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClientAppConfig> => {
    try {
      const [sections, features, mobile] = await Promise.all([
        getAppConfig<string[]>("home_sections", DEFAULT_CONFIG.homeSections),
        getAppConfig<Record<string, boolean>>("features", DEFAULT_CONFIG.features),
        getAppConfig<ClientAppConfig["mobileApp"]>("mobile_app", DEFAULT_CONFIG.mobileApp),
      ]);

      return {
        homeSections: sections,
        features,
        mobileApp: mobile,
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  },
);
