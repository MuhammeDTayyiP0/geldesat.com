import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { asJson, num } from "@/lib/utils";
import { adminMiddleware, IST, likeTerm, ts, tsOrNull } from "./common";

const KPI_SQL = `select
  (select count(*) from listings) as listings_total,
  (select count(*) from listings where status='ACTIVE' and (expires_at is null or expires_at > now())) as listings_live,
  (select count(*) from listings where status='PENDING') as listings_pending,
  (select count(*) from listings where status='ACTIVE' and expires_at <= now()) as listings_expired,
  (select count(*) from listings where status='REJECTED') as listings_rejected,
  (select count(*) from listings where created_at >= $1::timestamptz) as listings_today,
  (select count(*) from listings where created_at > now() - interval '7 days') as listings_7d,
  (select count(*) from listings where created_at > now() - interval '14 days' and created_at <= now() - interval '7 days') as listings_prev_7d,
  (select count(*) from profiles) as users_total,
  (select count(*) from profiles where created_at >= $1::timestamptz) as users_today,
  (select count(*) from profiles where created_at > now() - interval '7 days') as users_7d,
  (select count(*) from profiles where created_at > now() - interval '14 days' and created_at <= now() - interval '7 days') as users_prev_7d,
  (select count(*) from profiles where last_seen_at > now() - interval '1 day') as users_active_24h,
  (select count(*) from profiles where banned_at is not null) as users_banned,
  (select count(*) from profiles where deletion_requested_at is not null) as users_closing,
  (select count(*) from messages where created_at >= $1::timestamptz) as messages_today,
  (select count(*) from messages where created_at > now() - interval '7 days') as messages_7d,
  (select count(*) from messages where created_at > now() - interval '14 days' and created_at <= now() - interval '7 days') as messages_prev_7d,
  (select count(*) from conversations where updated_at > now() - interval '7 days') as conversations_7d,
  (select count(*) from reports where status='OPEN') as reports_open,
  (select count(*) from reports where created_at > now() - interval '7 days') as reports_7d,
  (select count(*) from credit_orders where status='PENDING') as orders_pending,
  (select count(*) from stores) as stores_total,
  (select count(*) from reviews) as reviews_total,
  (select coalesce(sum(view_count), 0) from listings) as views_total,
  (select count(*) from phone_reveals where created_at > now() - interval '7 days') as phone_reveals_7d,
  (select count(*) from favorites where created_at > now() - interval '7 days') as favorites_7d,
  (select count(*) from categories) as categories_total,
  (select min(created_at) from listings where status='PENDING') as oldest_pending_at`;

/** Start of "today" in Turkish time, as an ISO timestamp. */
async function todayStart(sql: Awaited<ReturnType<typeof getSql>>): Promise<string> {
  const rows = await sql.query<{ t: string }>(
    `select ((now() at time zone '${IST}')::date::timestamp at time zone '${IST}')::text as t`,
  );
  return rows[0]?.t ?? new Date().toISOString();
}

/** Everything the dashboard shows, in one round trip from the client. */
export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const since = await todayStart(sql);
    const kpiRows = await sql.query<Record<string, unknown>>(KPI_SQL, [since]);
    const k = kpiRows[0] ?? {};
    const kpi = Object.fromEntries(
      Object.entries(k).filter(([key]) => key !== "oldest_pending_at").map(([key, v]) => [key, num(v)]),
    ) as Record<string, number>;

    // Daily series for the last 30 days, bucketed in Turkish time.
    const dayExpr = `to_char((created_at at time zone '${IST}')::date, 'YYYY-MM-DD')`;
    const start = `(((now() at time zone '${IST}')::date - 29)::timestamp at time zone '${IST}')`;
    const [days, l, u, m, r] = await Promise.all([
      sql.query<{ day: string }>(
        `select to_char(d, 'YYYY-MM-DD') as day
         from generate_series((now() at time zone '${IST}')::date - 29, (now() at time zone '${IST}')::date, interval '1 day') d`,
      ),
      sql.query<{ day: string; n: number }>(`select ${dayExpr} as day, count(*) as n from listings where created_at >= ${start} group by 1`),
      sql.query<{ day: string; n: number }>(`select ${dayExpr} as day, count(*) as n from profiles where created_at >= ${start} group by 1`),
      sql.query<{ day: string; n: number }>(`select ${dayExpr} as day, count(*) as n from messages where created_at >= ${start} group by 1`),
      sql.query<{ day: string; n: number }>(`select ${dayExpr} as day, count(*) as n from reports where created_at >= ${start} group by 1`),
    ]);
    const toMap = (rows: Array<{ day: string; n: number }>) => new Map(rows.map((x) => [x.day, num(x.n)]));
    const [lm, um, mm, rm] = [toMap(l), toMap(u), toMap(m), toMap(r)];
    const series = days.map(({ day }) => ({
      day,
      listings: lm.get(day) ?? 0,
      users: um.get(day) ?? 0,
      messages: mm.get(day) ?? 0,
      reports: rm.get(day) ?? 0,
    }));

    const [byRoot, byStatus, byCity, pending, recentUsers, recentAudit] = await Promise.all([
      sql.query<{ id: string; name: string; active: number; total: number }>(
        `with recursive tree as (
           select id, id as root_id from categories where parent_id is null
           union all
           select c.id, t.root_id from categories c join tree t on c.parent_id = t.id
         )
         select r.id, r.name,
                count(l.id) filter (where l.status = 'ACTIVE') as active,
                count(l.id) as total
         from tree t
         join categories r on r.id = t.root_id
         left join listings l on l.category_id = t.id
         group by r.id, r.name, r.sort_order
         order by active desc, r.sort_order`,
      ),
      sql.query<{ status: string; n: number }>("select status, count(*) as n from listings group by status"),
      sql.query<{ city: string; n: number }>(
        `select city, count(*) as n from listings
         where status = 'ACTIVE' and city is not null and city <> ''
         group by city order by n desc limit 8`,
      ),
      sql.query<Record<string, unknown>>(
        `select l.id, l.listing_no, l.title, l.price, l.currency, l.city, l.created_at,
                case when jsonb_array_length(l.images) > 0 then l.images->>0 end as cover,
                c.name as category_name, coalesce(p.display_name, 'Üye') as seller_name
         from listings l
         join categories c on c.id = l.category_id
         left join profiles p on p.user_id = l.user_id
         where l.status = 'PENDING'
         order by l.created_at asc limit 6`,
      ),
      sql.query<Record<string, unknown>>(
        `select p.user_id, p.display_name, p.avatar_url, p.city, p.created_at, u.email
         from profiles p left join "user" u on u.id = p.user_id
         order by p.created_at desc limit 6`,
      ),
      sql.query<Record<string, unknown>>(
        `select a.id, a.action, a.target_type, a.target_id, a.summary, a.created_at,
                coalesce(p.display_name, 'Yönetici') as admin_name
         from admin_audit_log a left join profiles p on p.user_id = a.admin_id
         order by a.created_at desc limit 8`,
      ),
    ]);

    return {
      kpi,
      oldestPendingAt: tsOrNull(k.oldest_pending_at),
      series,
      byRoot: byRoot.map((x) => ({ id: x.id, name: x.name, active: num(x.active), total: num(x.total) })),
      byStatus: Object.fromEntries(byStatus.map((x) => [x.status, num(x.n)])) as Record<string, number>,
      byCity: byCity.map((x) => ({ city: x.city, n: num(x.n) })),
      pending: pending.map((x) => ({
        id: String(x.id),
        listing_no: num(x.listing_no),
        title: String(x.title),
        price: num(x.price),
        currency: String(x.currency ?? "TRY"),
        city: x.city ? String(x.city) : null,
        created_at: ts(x.created_at),
        cover: x.cover ? String(x.cover) : null,
        category_name: String(x.category_name),
        seller_name: String(x.seller_name),
      })),
      recentUsers: recentUsers.map((x) => ({
        user_id: String(x.user_id),
        display_name: String(x.display_name ?? ""),
        avatar_url: x.avatar_url ? String(x.avatar_url) : null,
        city: x.city ? String(x.city) : null,
        email: x.email ? String(x.email) : null,
        created_at: ts(x.created_at),
      })),
      recentAudit: recentAudit.map(mapAudit),
    };
  });

/** Sidebar badges; cheap enough to poll. */
export const adminCounters = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select
         (select count(*) from listings where status='PENDING') as pending,
         (select count(*) from reports where status='OPEN') as reports,
         (select count(*) from credit_orders where status='PENDING') as orders`,
    );
    return { pending: num(rows[0]?.pending), reports: num(rows[0]?.reports), orders: num(rows[0]?.orders) };
  });

export function mapAudit(x: Record<string, unknown>) {
  return {
    id: String(x.id),
    action: String(x.action),
    target_type: String(x.target_type),
    target_id: x.target_id ? String(x.target_id) : null,
    summary: String(x.summary ?? ""),
    /** Extra details as JSON text (shipped as a string so any shape serializes). */
    meta: x.meta == null ? null : JSON.stringify(asJson<unknown>(x.meta, null)),
    created_at: ts(x.created_at),
    admin_id: x.admin_id ? String(x.admin_id) : null,
    admin_name: String(x.admin_name ?? "Yönetici"),
  };
}

export type AuditEntry = ReturnType<typeof mapAudit>;

/** Command palette: jump to a listing, member, category or store. */
export const adminGlobalSearch = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ q: z.string().trim().min(1).max(100) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const like = likeTerm(data.q);
    const digits = /^\d{4,15}$/.test(data.q) ? data.q : null;
    const [listings, users, categories, stores] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select l.id, l.listing_no, l.title, l.status
         from listings l
         where ($2::text is not null and l.listing_no::text = $2) or l.id = $3 or l.title ilike $1
         order by ($2::text is not null and l.listing_no::text = $2) desc, l.created_at desc limit 6`,
        [like, digits, data.q],
      ),
      sql.query<Record<string, unknown>>(
        `select p.user_id, p.display_name, u.email, p.role
         from profiles p left join "user" u on u.id = p.user_id
         where p.user_id = $2 or p.display_name ilike $1 or u.email ilike $1 or p.phone ilike $1
         order by p.created_at desc limit 6`,
        [like, data.q],
      ),
      sql.query<Record<string, unknown>>(
        `select c.id, c.name, pc.name as parent_name
         from categories c left join categories pc on pc.id = c.parent_id
         where c.name ilike $1 or c.id = $2 or c.slug = $2
         order by length(c.name), c.name limit 8`,
        [like, data.q],
      ),
      sql.query<Record<string, unknown>>(
        "select id, name, slug from stores where name ilike $1 or slug ilike $1 order by name limit 4",
        [like],
      ),
    ]);
    return {
      listings: listings.map((x) => ({ id: String(x.id), listing_no: num(x.listing_no), title: String(x.title), status: String(x.status) })),
      users: users.map((x) => ({
        user_id: String(x.user_id),
        display_name: String(x.display_name ?? ""),
        email: x.email ? String(x.email) : null,
        role: String(x.role),
      })),
      categories: categories.map((x) => ({ id: String(x.id), name: String(x.name), parent_name: x.parent_name ? String(x.parent_name) : null })),
      stores: stores.map((x) => ({ id: String(x.id), name: String(x.name), slug: String(x.slug) })),
    };
  });
