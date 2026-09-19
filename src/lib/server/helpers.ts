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

export async function ensureProfile(
  userId: string,
  seed?: { name?: string | null; email?: string | null; image?: string | null },
) {
  const sql = await getSql();
  const existing = await sql.query<{ user_id: string; role: string }>(
    "select user_id, role from profiles where user_id = $1",
    [userId],
  );
  if (existing[0]) return existing[0];

  const admins = await sql.query<{ n: number }>("select count(*)::int as n from profiles where role = 'ADMIN'");
  const role = (admins[0]?.n ?? 0) === 0 ? "ADMIN" : "USER";
  const name = seed?.name?.trim() || seed?.email?.split("@")[0] || "Üye";
  await sql.query(
    `insert into profiles (user_id, display_name, avatar_url, role)
     values ($1, $2, $3, $4)
     on conflict (user_id) do nothing`,
    [userId, name, seed?.image ?? null, role],
  );
  const row = await sql.query<{ user_id: string; role: string }>(
    "select user_id, role from profiles where user_id = $1",
    [userId],
  );
  return row[0] ?? { user_id: userId, role };
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
}

const ALLOWED_DATA = /^data:image\/(jpeg|png|webp);base64,/i;

/** Normalize a TR mobile number to 05XXXXXXXXX. */
export function normalizeTrPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let n = digits;
  if (n.startsWith("90") && n.length === 12) n = n.slice(2);
  if (n.length === 10 && n.startsWith("5")) n = `0${n}`;
  if (!/^05\d{9}$/.test(n)) {
    throw new Error("Geçerli bir cep telefonu girin (05xx xxx xx xx).");
  }
  return n;
}

export function assertImages(images: string[]) {
  if (images.length > 10) throw new Error("En fazla 10 fotoğraf yükleyebilirsiniz.");
  for (const img of images) {
    if (ALLOWED_DATA.test(img) && img.length <= 450_000) continue;
    throw new Error("Geçersiz görsel. Yalnızca JPEG/PNG/WebP (sıkıştırılmış) kabul edilir.");
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
