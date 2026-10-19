import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { asJson, listingSlug, num } from "@/lib/utils";
import { notify } from "../helpers";
import { deleteUnusedListingImages } from "../upload.server";
import { adminMiddleware, audit, likeTerm, paged, paging, PageInput, strOrNull, ts, tsOrNull, Where } from "./common";
import { mapAudit } from "./dashboard";

export const LISTING_STATUSES = ["PENDING", "ACTIVE", "INACTIVE", "SOLD", "REJECTED"] as const;

const ListFilter = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["ALL", "PENDING", "ACTIVE", "EXPIRED", "INACTIVE", "SOLD", "REJECTED"]).default("ALL"),
  categoryId: z.string().max(200).optional(),
  city: z.string().max(60).optional(),
  userId: z.string().max(200).optional(),
  flag: z.enum(["none", "featured", "reported", "no_photo"]).default("none"),
  sort: z.enum(["newest", "oldest", "updated", "price_desc", "price_asc", "views", "expires"]).default("newest"),
  ...PageInput,
});

const ORDER: Record<z.infer<typeof ListFilter>["sort"], string> = {
  newest: "l.created_at desc",
  oldest: "l.created_at asc",
  updated: "l.updated_at desc",
  price_desc: "l.price desc, l.created_at desc",
  price_asc: "l.price asc, l.created_at desc",
  views: "l.view_count desc, l.created_at desc",
  expires: "l.expires_at asc nulls last",
};

function mapRow(x: Record<string, unknown>) {
  return {
    id: String(x.id),
    listing_no: num(x.listing_no),
    slug: String(x.slug),
    title: String(x.title),
    price: num(x.price),
    currency: String(x.currency ?? "TRY"),
    status: String(x.status),
    city: strOrNull(x.city),
    district: strOrNull(x.district),
    cover: strOrNull(x.cover),
    photo_count: num(x.photo_count),
    category_id: String(x.category_id),
    category_name: String(x.category_name ?? ""),
    user_id: String(x.user_id),
    seller_name: String(x.seller_name ?? "Üye"),
    seller_banned: Boolean(x.seller_banned),
    store_name: strOrNull(x.store_name),
    view_count: num(x.view_count),
    fav_count: num(x.fav_count),
    open_reports: num(x.open_reports),
    featured_until: tsOrNull(x.featured_until),
    expires_at: tsOrNull(x.expires_at),
    approved_at: tsOrNull(x.approved_at),
    created_at: ts(x.created_at),
    updated_at: ts(x.updated_at),
  };
}

export type AdminListingRow = ReturnType<typeof mapRow>;

const ROW_SELECT = `
  l.id, l.listing_no, l.slug, l.title, l.price, l.currency, l.status, l.city, l.district,
  case when jsonb_array_length(l.images) > 0 then l.images->>0 end as cover,
  jsonb_array_length(l.images) as photo_count,
  l.category_id, c.name as category_name, l.user_id,
  coalesce(p.display_name, 'Üye') as seller_name, (p.banned_at is not null) as seller_banned,
  s.name as store_name, l.view_count,
  (select count(*) from favorites f where f.listing_id = l.id) as fav_count,
  (select count(*) from reports r where r.listing_id = l.id and r.status = 'OPEN') as open_reports,
  l.featured_until, l.expires_at, l.approved_at, l.created_at, l.updated_at`;

const ROW_FROM = `
  from listings l
  join categories c on c.id = l.category_id
  left join profiles p on p.user_id = l.user_id
  left join stores s on s.id = l.store_id`;

export const adminListListings = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(ListFilter)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.status === "ACTIVE") w.add("l.status = 'ACTIVE' and (l.expires_at is null or l.expires_at > now())");
    else if (data.status === "EXPIRED") w.add("l.status = 'ACTIVE' and l.expires_at <= now()");
    else if (data.status !== "ALL") w.add(`l.status = ${w.param(data.status)}`);
    if (data.q) {
      const q = data.q.replace(/^#/, "");
      if (/^\d{4,15}$/.test(q)) w.add(`(l.listing_no::text = ${w.param(q)} or l.title ilike ${w.param(likeTerm(q))})`);
      else {
        const like = w.param(likeTerm(q));
        w.add(`(l.title ilike ${like} or p.display_name ilike ${like} or l.id = ${w.param(q)})`);
      }
    }
    if (data.categoryId) {
      w.add(`l.category_id in (
        with recursive t as (select id from categories where id = ${w.param(data.categoryId)}
          union all select c2.id from categories c2 join t on c2.parent_id = t.id)
        select id from t)`);
    }
    if (data.city) w.add(`l.city = ${w.param(data.city)}`);
    if (data.userId) w.add(`l.user_id = ${w.param(data.userId)}`);
    if (data.flag === "featured") w.add("l.featured_until > now()");
    if (data.flag === "reported") w.add("exists (select 1 from reports r where r.listing_id = l.id and r.status = 'OPEN')");
    if (data.flag === "no_photo") w.add("jsonb_array_length(l.images) = 0");

    const { limit, offset } = paging(data.page, data.pageSize);
    const [rows, count, statusCounts] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select ${ROW_SELECT} ${ROW_FROM} ${w.sql} order by ${ORDER[data.sort]} limit ${limit} offset ${offset}`,
        w.params,
      ),
      sql.query<{ n: number }>(`select count(*) as n ${ROW_FROM} ${w.sql}`, w.params),
      sql.query<Record<string, unknown>>(
        `select
           count(*) as all,
           count(*) filter (where status='PENDING') as pending,
           count(*) filter (where status='ACTIVE' and (expires_at is null or expires_at > now())) as active,
           count(*) filter (where status='ACTIVE' and expires_at <= now()) as expired,
           count(*) filter (where status='INACTIVE') as inactive,
           count(*) filter (where status='SOLD') as sold,
           count(*) filter (where status='REJECTED') as rejected
         from listings`,
      ),
    ]);
    const sc = statusCounts[0] ?? {};
    return {
      ...paged(rows.map(mapRow), num(count[0]?.n), data.page, data.pageSize),
      statusCounts: {
        ALL: num(sc.all),
        PENDING: num(sc.pending),
        ACTIVE: num(sc.active),
        EXPIRED: num(sc.expired),
        INACTIVE: num(sc.inactive),
        SOLD: num(sc.sold),
        REJECTED: num(sc.rejected),
      },
    };
  });

/** Everything a moderator needs to judge one listing. */
export const adminListingDetail = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ id: z.string().max(200) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${ROW_SELECT}, l.description, l.images, l.attrs, l.neighborhood, l.phone_override, l.store_id,
              (select count(*) from phone_reveals pr where pr.listing_id = l.id) as phone_reveals,
              (select count(*) from conversations cv where cv.listing_id = l.id) as conversations
       ${ROW_FROM} where l.id = $1`,
      [data.id],
    );
    const x = rows[0];
    if (!x) throw new Error("İlan bulunamadı.");
    const listing = {
      ...mapRow(x),
      description: String(x.description ?? ""),
      images: asJson<string[]>(x.images, []),
      attrs: asJson<Record<string, string | number | string[]>>(x.attrs, {}),
      neighborhood: strOrNull(x.neighborhood),
      phone_override: strOrNull(x.phone_override),
      phone_reveals: num(x.phone_reveals),
      conversations: num(x.conversations),
    };
    const userId = listing.user_id;
    const [path, seller, reports, history, log] = await Promise.all([
      sql.query<{ id: string; name: string }>(
        `with recursive chain as (
           select id, name, parent_id, 0 as depth from categories where id = $1
           union all
           select c.id, c.name, c.parent_id, ch.depth + 1 from categories c join chain ch on ch.parent_id = c.id
         ) select id, name from chain order by depth desc`,
        [listing.category_id],
      ),
      sql.query<Record<string, unknown>>(
        `select p.user_id, p.display_name, p.phone, p.city, p.created_at, p.role, p.banned_at, p.avatar_url,
                u.email, u."emailVerified" as email_verified,
                (select count(*) from listings where user_id = p.user_id) as listings_total,
                (select count(*) from listings where user_id = p.user_id and status = 'ACTIVE') as listings_active,
                (select count(*) from listings where user_id = p.user_id and status = 'REJECTED') as listings_rejected,
                (select count(*) from reports r join listings l2 on l2.id = r.listing_id where l2.user_id = p.user_id) as reports_against
         from profiles p left join "user" u on u.id = p.user_id where p.user_id = $1`,
        [userId],
      ),
      sql.query<Record<string, unknown>>(
        `select r.id, r.reason, r.details, r.status, r.created_at, coalesce(p.display_name, 'Üye') as reporter_name
         from reports r left join profiles p on p.user_id = r.reporter_id
         where r.listing_id = $1 order by r.created_at desc limit 20`,
        [data.id],
      ),
      sql.query<{ price: unknown; recorded_at: unknown }>(
        "select price, recorded_at from price_history where listing_id = $1 order by recorded_at desc limit 12",
        [data.id],
      ),
      sql.query<Record<string, unknown>>(
        `select a.*, coalesce(p.display_name, 'Yönetici') as admin_name
         from admin_audit_log a left join profiles p on p.user_id = a.admin_id
         where a.target_type = 'listing' and a.target_id = $1
         order by a.created_at desc limit 15`,
        [data.id],
      ),
    ]);
    const s = seller[0];
    return {
      listing,
      path,
      seller: s
        ? {
            user_id: String(s.user_id),
            display_name: String(s.display_name ?? ""),
            email: strOrNull(s.email),
            email_verified: Boolean(s.email_verified),
            phone: strOrNull(s.phone),
            city: strOrNull(s.city),
            avatar_url: strOrNull(s.avatar_url),
            role: String(s.role),
            banned: s.banned_at != null,
            created_at: ts(s.created_at),
            listings_total: num(s.listings_total),
            listings_active: num(s.listings_active),
            listings_rejected: num(s.listings_rejected),
            reports_against: num(s.reports_against),
          }
        : null,
      reports: reports.map((r) => ({
        id: String(r.id),
        reason: String(r.reason),
        details: strOrNull(r.details),
        status: String(r.status),
        created_at: ts(r.created_at),
        reporter_name: String(r.reporter_name),
      })),
      priceHistory: history.map((h) => ({ price: num(h.price), at: ts(h.recorded_at) })),
      log: log.map(mapAudit),
    };
  });

export type AdminListingDetail = Awaited<ReturnType<typeof adminListingDetail>>;

const BulkInput = z.object({
  ids: z.array(z.string().max(200)).min(1).max(200),
  action: z.enum(["approve", "reject", "deactivate", "activate", "sold", "extend", "feature", "unfeature", "move", "delete"]),
  reason: z.string().trim().max(500).optional(),
  days: z.number().int().min(1).max(365).optional(),
  categoryId: z.string().max(200).optional(),
  notify: z.boolean().default(true),
});

const ACTION_LABEL: Record<z.infer<typeof BulkInput>["action"], string> = {
  approve: "onaylandı",
  reject: "reddedildi",
  deactivate: "yayından kaldırıldı",
  activate: "yayına alındı",
  sold: "satıldı olarak işaretlendi",
  extend: "süresi uzatıldı",
  feature: "vitrine alındı",
  unfeature: "vitrinden çıkarıldı",
  move: "kategorisi değiştirildi",
  delete: "silindi",
};

/** One action on up to 200 listings: moderation, visibility, duration, vitrin, category, delete. */
export const adminListingsAction = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(BulkInput)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string; user_id: string; slug: string; title: string; listing_no: number; images: unknown; status: string }>(
      "select id, user_id, slug, title, listing_no, images, status from listings where id = any($1::text[])",
      [data.ids],
    );
    if (!rows.length) throw new Error("İlan bulunamadı.");
    const ids = rows.map((r) => r.id);
    const reason = data.reason?.trim() || "";

    switch (data.action) {
      case "approve":
        // The 30-day run starts when the listing goes live.
        await sql.query(
          `update listings set status='ACTIVE', approved_at=now(), updated_at=now(),
             expires_at=greatest(coalesce(expires_at, now()), now() + interval '30 days')
           where id = any($1::text[])`,
          [ids],
        );
        break;
      case "reject":
        await sql.query("update listings set status='REJECTED', approved_at=null, updated_at=now() where id = any($1::text[])", [ids]);
        break;
      case "deactivate":
        await sql.query("update listings set status='INACTIVE', updated_at=now() where id = any($1::text[])", [ids]);
        break;
      case "activate":
        // An admin putting a listing live approves it.
        await sql.query(
          `update listings set status='ACTIVE', approved_at=coalesce(approved_at, now()), updated_at=now(),
             expires_at=case when expires_at is null or expires_at < now() then now() + interval '30 days' else expires_at end
           where id = any($1::text[])`,
          [ids],
        );
        break;
      case "sold":
        await sql.query("update listings set status='SOLD', updated_at=now() where id = any($1::text[])", [ids]);
        break;
      case "extend":
        await sql.query(
          `update listings set expires_at = greatest(coalesce(expires_at, now()), now()) + make_interval(days => $2), updated_at=now()
           where id = any($1::text[])`,
          [ids, data.days ?? 30],
        );
        break;
      case "feature":
        await sql.query(
          "update listings set featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => $2) where id = any($1::text[])",
          [ids, data.days ?? 7],
        );
        break;
      case "unfeature":
        await sql.query("update listings set featured_until = null where id = any($1::text[])", [ids]);
        break;
      case "move": {
        if (!data.categoryId) throw new Error("Hedef kategori seçin.");
        const cat = await sql.query<{ id: string }>("select id from categories where id = $1", [data.categoryId]);
        if (!cat[0]) throw new Error("Hedef kategori bulunamadı.");
        await sql.query("update listings set category_id=$2, updated_at=now() where id = any($1::text[])", [ids, data.categoryId]);
        break;
      }
      case "delete":
        await sql.query("delete from listings where id = any($1::text[])", [ids]);
        for (const r of rows) await deleteUnusedListingImages(sql, r.user_id, asJson<string[]>(r.images, []));
        break;
    }

    if (data.notify) {
      for (const r of rows) {
        const link = `/ilan/${r.slug}`;
        if (data.action === "approve") {
          await notify(r.user_id, "listing", "İlanınız yayında", `"${r.title}" onaylandı ve yayına alındı.`, link);
        } else if (data.action === "reject") {
          await notify(
            r.user_id,
            "listing",
            "İlanınız reddedildi",
            `"${r.title}" şu gerekçeyle reddedildi: ${reason || "Yayın kurallarına uygun bulunmadı"}. Düzenleyip tekrar onaya gönderebilirsiniz.`,
            link,
          );
        } else if (data.action === "deactivate") {
          await notify(
            r.user_id,
            "listing",
            "İlanınız yayından kaldırıldı",
            `"${r.title}" yönetim tarafından yayından kaldırıldı.${reason ? ` Gerekçe: ${reason}` : ""}`,
            link,
          );
        }
      }
    }

    const summary =
      rows.length === 1
        ? `#${rows[0].listing_no} "${rows[0].title}" ${ACTION_LABEL[data.action]}${reason ? ` — ${reason}` : ""}`
        : `${rows.length} ilan ${ACTION_LABEL[data.action]}${reason ? ` — ${reason}` : ""}`;
    for (const r of rows) {
      await audit(sql, context.adminId, `listing.${data.action}`, "listing", r.id, rows.length === 1 ? summary : `#${r.listing_no} "${r.title}" ${ACTION_LABEL[data.action]}`, {
        reason: reason || undefined,
        days: data.days,
        categoryId: data.categoryId,
        from: r.status,
      });
    }
    return { ok: true as const, count: rows.length, summary };
  });

/** Admin correction of the text fields and price. */
export const adminUpdateListing = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      id: z.string().max(200),
      title: z.string().trim().min(5).max(100),
      description: z.string().trim().min(10).max(5000),
      price: z.number().min(0).max(1_000_000_000),
      city: z.string().trim().max(60).optional(),
      district: z.string().trim().max(60).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ listing_no: number; price: unknown; title: string }>(
      "select listing_no, price, title from listings where id = $1",
      [data.id],
    );
    const cur = rows[0];
    if (!cur) throw new Error("İlan bulunamadı.");
    const slug = listingSlug(data.title, cur.listing_no);
    await sql.query(
      `update listings set title=$2, description=$3, price=$4, slug=$5,
         city=coalesce(nullif($6, ''), city), district=coalesce(nullif($7, ''), district), updated_at=now()
       where id=$1`,
      [data.id, data.title, data.description, data.price, slug, data.city ?? "", data.district ?? ""],
    );
    if (num(cur.price) !== data.price) {
      await sql.query("insert into price_history (listing_id, price) values ($1,$2)", [data.id, data.price]);
    }
    await audit(sql, context.adminId, "listing.edit", "listing", data.id, `#${cur.listing_no} ilan bilgileri düzenlendi`, {
      title: cur.title !== data.title ? { from: cur.title, to: data.title } : undefined,
      price: num(cur.price) !== data.price ? { from: num(cur.price), to: data.price } : undefined,
    });
    return { ok: true as const, slug };
  });

/** Cities that have listings, for the filter dropdown. */
export const adminListingCities = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql.query<{ city: string; n: number }>(
      "select city, count(*) as n from listings where city is not null and city <> '' group by city order by city",
    );
    return rows.map((r) => ({ city: r.city, n: num(r.n) }));
  });
