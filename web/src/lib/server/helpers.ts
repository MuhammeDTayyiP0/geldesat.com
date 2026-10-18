import { getSql } from "@/lib/db";
import { asJson, num } from "@/lib/utils";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon: string | null;
  sort_order: number;
  has_children?: boolean;
};

export type ListingCard = {
  id: string;
  slug: string;
  user_id: string;
  store_id: string | null;
  category_id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  status: string;
  city: string | null;
  district: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  images: string[];
  attrs: Record<string, string | number>;
  view_count: number;
  featured_until: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_slug?: string;
  seller_name?: string;
  store_name?: string;
  store_slug?: string;
  boosts?: string[];
};

export type AttrDef = {
  id: string;
  name: string;
  type: string;
  options: string[] | null;
  unit: string | null;
  required: boolean;
};

const buckets = new Map<string, { n: number; t: number }>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || now - hit.t > windowMs) {
    buckets.set(key, { n: 1, t: now });
    return;
  }
  if (hit.n >= max) {
    throw new Error("Çok fazla istek. Lütfen biraz bekleyin.");
  }
  hit.n += 1;
}

export function mapListing(row: Record<string, unknown>): ListingCard {
  return {
    id: String(row.id),
    slug: String(row.slug),
    user_id: String(row.user_id),
    store_id: row.store_id ? String(row.store_id) : null,
    category_id: String(row.category_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    price: num(row.price),
    currency: String(row.currency ?? "TRY"),
    status: String(row.status),
    city: row.city ? String(row.city) : null,
    district: row.district ? String(row.district) : null,
    neighborhood: row.neighborhood ? String(row.neighborhood) : null,
    lat: row.lat == null ? null : num(row.lat),
    lng: row.lng == null ? null : num(row.lng),
    images: asJson<string[]>(row.images, []),
    attrs: asJson<Record<string, string | number>>(row.attrs, {}),
    view_count: num(row.view_count),
    featured_until: row.featured_until ? String(row.featured_until) : null,
    expires_at: row.expires_at ? String(row.expires_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    category_name: row.category_name ? String(row.category_name) : undefined,
    category_slug: row.category_slug ? String(row.category_slug) : undefined,
    seller_name: row.seller_name ? String(row.seller_name) : undefined,
    store_name: row.store_name ? String(row.store_name) : undefined,
    store_slug: row.store_slug ? String(row.store_slug) : undefined,
    boosts: asJson<string[]>(row.boosts, []),
  };
}

export async function subtreeIds(slugOrId: string): Promise<string[]> {
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `with recursive tree as (
       select id from categories where slug = $1 or id = $1
       union all
       select c.id from categories c join tree t on c.parent_id = t.id
     )
     select id from tree`,
    [slugOrId],
  );
  return rows.map((r) => r.id);
}

export async function inheritedAttributes(categoryId: string): Promise<AttrDef[]> {
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `with recursive chain as (
       select id, parent_id from categories where id = $1
       union all
       select c.id, c.parent_id from categories c join chain ch on ch.parent_id = c.id
     )
     select distinct on (a.id) a.id, a.name, a.type, a.options, a.unit, ca.required
     from chain ch
     join category_attributes ca on ca.category_id = ch.id
     join attribute_defs a on a.id = ca.attribute_id
     order by a.id, ca.required desc`,
    [categoryId],
  );
  return rows
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      type: String(r.type),
      options: asJson<string[] | null>(r.options, null),
      unit: r.unit ? String(r.unit) : null,
      required: Boolean(r.required),
    }))
    .sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name, "tr"));
}

/**
 * Admins are granted explicitly, never by sign-up order: either by SQL
 * (`update profiles set role='ADMIN' where user_id=…`) or by listing the
 * account's email in `ADMIN_EMAILS` (comma-separated). The env route only
 * applies once Better Auth marks the email verified (e.g. Google sign-in), so a
 * password sign-up cannot claim an admin address it does not own.
 */
function bootstrapAdminEmails(): Set<string> {
  const raw = typeof process !== "undefined" ? process.env.ADMIN_EMAILS : undefined;
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** The local preview's shared account when auth is off (see verify.server.ts). */
const DEV_USER_ID = "dev-user";

async function isBootstrapAdmin(sql: Awaited<ReturnType<typeof getSql>>, userId: string): Promise<boolean> {
  if (userId === DEV_USER_ID) return true;
  const emails = bootstrapAdminEmails();
  if (!emails.size) return false;
  try {
    const rows = await sql.query<{ email: string | null; emailVerified: boolean | null }>(
      'select email, "emailVerified" from "user" where id = $1 limit 1',
      [userId],
    );
    const email = rows[0]?.email?.trim().toLowerCase();
    return Boolean(rows[0]?.emailVerified && email && emails.has(email));
  } catch {
    return false;
  }
}

export async function ensureProfile(
  userId: string,
  seed?: { name?: string | null; email?: string | null; image?: string | null },
) {
  const sql = await getSql();

  // If seed info is missing, try to resolve from the Better Auth "user" table
  let resolvedName = seed?.name?.trim();
  let resolvedEmail = seed?.email?.trim();
  let resolvedImage = seed?.image ?? null;

  if (!resolvedName || !resolvedEmail) {
    try {
      const uRows = await sql.query<{ name?: string | null; email?: string | null; image?: string | null }>(
        'select name, email, image from "user" where id = $1 limit 1',
        [userId],
      );
      if (uRows[0]) {
        if (!resolvedName && uRows[0].name) resolvedName = uRows[0].name.trim();
        if (!resolvedEmail && uRows[0].email) resolvedEmail = uRows[0].email.trim();
        if (!resolvedImage && uRows[0].image) resolvedImage = uRows[0].image;
      }
    } catch {
      // "user" table might not exist in un-migrated dev environments
    }
  }

  const existing = await sql.query<{ user_id: string; role: string; display_name?: string | null }>(
    "select user_id, role, display_name from profiles where user_id = $1",
    [userId],
  );
  if (existing[0]) {
    // If the profile exists but display_name is the generic fallback "Üye" (or empty),
    // and we now have a real registered name, automatically update the profile!
    if (
      (!existing[0].display_name || existing[0].display_name === "Üye") &&
      resolvedName &&
      resolvedName !== "Üye"
    ) {
      await sql.query("update profiles set display_name = $1 where user_id = $2", [resolvedName, userId]);
      existing[0].display_name = resolvedName;
    }
    if (existing[0].role !== "ADMIN" && (await isBootstrapAdmin(sql, userId))) {
      await sql.query("update profiles set role = 'ADMIN' where user_id = $1", [userId]);
      existing[0].role = "ADMIN";
    }
    return existing[0];
  }

  const role = (await isBootstrapAdmin(sql, userId)) ? "ADMIN" : "USER";
  const name = resolvedName || resolvedEmail?.split("@")[0] || "Üye";
  await sql.query(
    `insert into profiles (user_id, display_name, avatar_url, role)
     values ($1, $2, $3, $4)
     on conflict (user_id) do nothing`,
    [userId, name, resolvedImage, role],
  );
  const row = await sql.query<{ user_id: string; role: string; display_name: string }>(
    "select user_id, role, display_name from profiles where user_id = $1",
    [userId],
  );
  return row[0] ?? { user_id: userId, role, display_name: name };
}

export async function requireAdmin(userId: string) {
  const profile = await ensureProfile(userId);
  if (profile.role !== "ADMIN") throw new Error("Yetkisiz işlem");
  return profile;
}

export async function creditBalance(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ bal: number }>(
    "select coalesce(sum(amount),0)::int as bal from credit_ledger where user_id = $1",
    [userId],
  );
  return rows[0]?.bal ?? 0;
}

export async function notify(userId: string, type: string, title: string, body: string, link: string) {
  const sql = await getSql();
  await sql.query(
    `insert into notifications (id, user_id, type, title, body, link)
     values ($1, $2, $3, $4, $5, $6)`,
    [`ntf_${crypto.randomUUID().slice(0, 12)}`, userId, type, title, body, link],
  );

  // Push delivery is best effort: an Expo outage must not break the action that
  // created the in-app notification.
  try {
    const devices = await sql.query<{ token: string }>(
      "select token from mobile_push_tokens where user_id=$1",
      [userId],
    );
    if (devices.length) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(devices.map(({ token }) => ({
          to: token,
          title,
          body,
          sound: "default",
          data: { link },
          channelId: "default",
        }))),
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) {
        console.warn(`[push] Expo returned ${response.status}`);
      } else {
        const tickets = await response.json().catch(() => null) as { data?: Array<{ status?: string; details?: { error?: string } }> } | null;
        const staleTokens = devices.filter((_, index) =>
          tickets?.data?.[index]?.status === "error" && tickets.data[index]?.details?.error === "DeviceNotRegistered",
        );
        if (staleTokens.length) {
          await Promise.all(staleTokens.map(({ token }) =>
            sql.query("delete from mobile_push_tokens where token=$1", [token]),
          ));
        }
      }
    }
  } catch (error) {
    console.warn("[push] Notification delivery failed", error instanceof Error ? error.message : "unknown error");
  }
}

const ALLOWED_DATA = /^data:image\/(jpeg|png|webp);base64,/i;
const ALLOWED_UPLOAD_PATH = /^\/uploads\/[-a-zA-Z0-9_.]+\.(webp|jpg|jpeg|png)$/i;
const ALLOWED_MOBILE_IMAGE_PATH = /^\/api\/mobile\/images\/[0-9a-f-]{36}$/i;
const ALLOWED_HTTP_URL = /^https?:\/\/[^\s]+$/i;

/** Normalize a TR mobile number to 05XXXXXXXXX. */
export function normalizeTrPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let n = digits;
  if (n.startsWith("90") && n.length === 12) n = n.slice(2);
  if (n.length === 10 && n.startsWith("5")) n = `0${n}`;
  if (!/^05\d{9}$/.test(n)) {
    throw new Error("Geçerli bir cep telefonu girin (5xx xxx xx xx).");
  }
  return n;
}

export function assertImages(images: string[]) {
  if (images.length > 10) throw new Error("En fazla 10 fotoğraf yükleyebilirsiniz.");
  for (const img of images) {
    if (ALLOWED_UPLOAD_PATH.test(img) || ALLOWED_MOBILE_IMAGE_PATH.test(img)) continue;
    if (ALLOWED_HTTP_URL.test(img) && img.length <= 2048) continue;
    if (ALLOWED_DATA.test(img) && img.length <= 450_000) continue;
    throw new Error("Geçersiz görsel. Yalnızca JPEG/PNG/WebP formatı kabul edilir.");
  }
}

export function listingSelect(extra = "", onlyCover = false) {
  const imagesExpr = onlyCover
    ? "case when jsonb_array_length(l.images) > 0 then jsonb_build_array(l.images->0) else '[]'::jsonb end as images"
    : "l.images";
  return `
    l.id, l.slug, l.user_id, l.store_id, l.category_id, l.title, l.description,
    l.price, l.currency, l.status, l.city, l.district, l.neighborhood, l.lat, l.lng,
    ${imagesExpr}, l.attrs, l.view_count, l.featured_until, l.expires_at, l.created_at, l.updated_at,
    c.name as category_name, c.slug as category_slug,
    coalesce(p.display_name, 'Satıcı') as seller_name,
    s.name as store_name, s.slug as store_slug
    ${extra}
  `;
}
