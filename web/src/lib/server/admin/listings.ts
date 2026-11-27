import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { liveSql } from "@/lib/listing-status";
import { cleanAttrs, type AttrValues } from "@/lib/listing-attrs";
import { asJson, listingSlug, num } from "@/lib/utils";
import { getCategoryTree } from "../category-cache";
import { notifySellerFollowers } from "../follows";
import { inheritedAttributes, notify } from "../helpers";
import { notifyMatchingSavedSearches } from "../saved-searches";
import { deleteUnusedListingImages } from "../upload.server";
import { adminMiddleware, audit, auditMany, likeTerm, paged, paging, PageInput, strOrNull, ts, tsOrNull, Where } from "./common";
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
    rejection_reason: strOrNull(x.rejection_reason),
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
  l.id, l.listing_no, l.slug, l.title, l.price, l.currency, l.status, l.rejection_reason, l.city, l.district,
  case when jsonb_array_length(l.images) > 0 then l.images->>0 end as cover,
  jsonb_array_length(l.images) as photo_count,
  l.category_id, c.name as category_name, l.user_id,
  coalesce(p.display_name, 'Üye') as seller_name, (p.banned_at is not null) as seller_banned,
  s.name as store_name, l.view_count,
  (select count(*) from favorites f where f.listing_id = l.id) as fav_count,
  (select count(*) from reports r where r.listing_id = l.id and r.status = 'OPEN' and r.conversation_id is null) as open_reports,
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
      const q = data.q.replace(/^#/, "").replace(/\s+/g, "");
      if (/^\d{4,15}$/.test(q)) w.add(`(l.listing_no = ${w.param(q)}::bigint or l.title ilike ${w.param(likeTerm(data.q))})`);
      else {
        const like = w.param(likeTerm(data.q));
        w.add(`(l.title ilike ${like} or p.display_name ilike ${like} or l.id = ${w.param(data.q)})`);
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
    if (data.flag === "reported") w.add("exists (select 1 from reports r where r.listing_id = l.id and r.status = 'OPEN' and r.conversation_id is null)");
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
              (select count(distinct pr.viewer_id) from phone_reveals pr where pr.listing_id = l.id) as phone_reveals,
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
    const [path, seller, reports, history, log, categoryAttributes, activeBoosts] = await Promise.all([
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
                (select count(*) from listings l where l.user_id = p.user_id and ${liveSql()}) as listings_active,
                (select count(*) from listings where user_id = p.user_id and status = 'REJECTED') as listings_rejected,
                (select count(*) from reports r
                   left join listings l2 on l2.id = r.listing_id
                   left join conversations cv on cv.id = r.conversation_id
                  where (r.conversation_id is null and coalesce(l2.user_id, r.listing_snapshot->>'user_id') = p.user_id)
                     or (r.conversation_id is not null and r.reporter_id <> p.user_id and p.user_id in (cv.buyer_id, cv.seller_id))) as reports_against
         from profiles p left join "user" u on u.id = p.user_id where p.user_id = $1`,
        [userId],
      ),
      sql.query<Record<string, unknown>>(
        `select r.id, r.reporter_id, r.reason, r.details, r.status, r.created_at, coalesce(p.display_name, 'Üye') as reporter_name
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
      inheritedAttributes(listing.category_id),
      sql.query<{ id: string; kind: string; starts_at: unknown; ends_at: unknown }>(
        "select id, kind, starts_at, ends_at from boosts where listing_id = $1 and ends_at > now() order by ends_at desc",
        [data.id],
      ),
    ]);
    const s = seller[0];
    return {
      listing,
      path,
      categoryAttributes,
      boosts: activeBoosts.map((b) => ({
        id: b.id,
        kind: b.kind,
        starts_at: ts(b.starts_at),
        ends_at: ts(b.ends_at),
      })),
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
        reporter_id: strOrNull(r.reporter_id),
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

/** Which statuses each action applies to; actions not listed work on any listing. */
const ACTION_FROM: Partial<Record<string, string[]>> = {
  approve: ["PENDING"],
  reject: ["PENDING", "ACTIVE", "INACTIVE"],
  deactivate: ["ACTIVE"],
  activate: ["INACTIVE", "PENDING", "REJECTED"],
  sold: ["ACTIVE", "INACTIVE"],
  extend: ["ACTIVE", "INACTIVE"],
  feature: ["ACTIVE", "INACTIVE"],
};
/** Actions that put a listing live: never for a suspended or closing owner, whose listings must stay hidden. */
const GOES_LIVE = new Set(["approve", "activate"]);

/** One action on up to 200 listings: moderation, visibility, duration, vitrin, category, delete. */
export const adminListingsAction = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(BulkInput)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const reason = data.reason?.trim() || "";
    const { found, actedRows } = await sql.transaction(async (tx) => {
      const found = await tx.query<{
        id: string;
        user_id: string;
        slug: string;
        title: string;
        listing_no: number;
        images: unknown;
        status: string;
        category_id: string;
        city: string | null;
        district: string | null;
        neighborhood: string | null;
        price: string | number;
        attrs: unknown;
        store_id: string | null;
        seller_name: string | null;
        owner_banned: boolean;
        owner_closing: boolean;
      }>(
        `select l.id, l.user_id, l.slug, l.title, l.listing_no, l.images, l.status,
                l.category_id, l.city, l.district, l.neighborhood, l.price, l.attrs, l.store_id,
                p.display_name as seller_name,
                (p.banned_at is not null) as owner_banned,
                (p.deletion_requested_at is not null) as owner_closing
         from listings l left join profiles p on p.user_id = l.user_id
         where l.id = any($1::text[])
         for update of l`,
        [data.ids],
      );
      if (!found.length) throw new Error("İlan bulunamadı.");

      const allowed = ACTION_FROM[data.action];
      const rows = found.filter(
        (r) => (!allowed || allowed.includes(r.status)) && !(GOES_LIVE.has(data.action) && (r.owner_banned || r.owner_closing)),
      );
      if (!rows.length) {
        if (GOES_LIVE.has(data.action) && found.every((r) => r.owner_banned || r.owner_closing)) {
          throw new Error("Satıcı hesabı askıda veya silinme sürecinde olduğu için ilan yayına alınamaz.");
        }
        throw new Error("Seçili ilanlar bu işleme uygun değil. Başka bir yönetici işlemiş olabilir.");
      }

      const ids = rows.map((r) => r.id);
      const statuses = allowed ?? [];
      let updatedIds: string[];

      switch (data.action) {
        case "approve": {
          // The 30-day run starts when the listing goes live.
          const res = await tx.query<{ id: string }>(
            `update listings l set status='ACTIVE', approved_at=now(), status_before_ban=null, rejection_reason=null, updated_at=now(),
               expires_at=greatest(coalesce(expires_at, now()), now() + interval '30 days')
             where l.id = any($1::text[]) and l.status = any($2::text[])
               and exists (select 1 from profiles p where p.user_id = l.user_id and p.banned_at is null and p.deletion_requested_at is null)
             returning l.id`,
            [ids, statuses],
          );
          updatedIds = res.map((r) => r.id);
          break;
        }
        case "reject": {
          const res = await tx.query<{ id: string }>(
            "update listings set status='REJECTED', approved_at=null, status_before_ban=null, rejection_reason=$3, updated_at=now() where id = any($1::text[]) and status = any($2::text[]) returning id",
            [ids, statuses, reason || null],
          );
          updatedIds = res.map((r) => r.id);
          break;
        }
        case "deactivate": {
          const res = await tx.query<{ id: string }>(
            "update listings set status='INACTIVE', status_before_ban=null, updated_at=now() where id = any($1::text[]) and status = any($2::text[]) returning id",
            [ids, statuses],
          );
          updatedIds = res.map((r) => r.id);
          break;
        }
        case "activate": {
          // An admin putting a listing live approves it.
          const res = await tx.query<{ id: string }>(
            `update listings l set status='ACTIVE', approved_at=coalesce(approved_at, now()), status_before_ban=null, rejection_reason=null, updated_at=now(),
               expires_at=case when expires_at is null or expires_at < now() then now() + interval '30 days' else expires_at end
             where l.id = any($1::text[]) and l.status = any($2::text[])
               and exists (select 1 from profiles p where p.user_id = l.user_id and p.banned_at is null and p.deletion_requested_at is null)
             returning l.id`,
            [ids, statuses],
          );
          updatedIds = res.map((r) => r.id);
          break;
        }
        case "sold": {
          const res = await tx.query<{ id: string }>(
            "update listings set status='SOLD', status_before_ban=null, updated_at=now() where id = any($1::text[]) and status = any($2::text[]) returning id",
            [ids, statuses],
          );
          updatedIds = res.map((r) => r.id);
          break;
        }
        case "extend": {
          const res = await tx.query<{ id: string }>(
            `update listings set expires_at = greatest(coalesce(expires_at, now()), now()) + make_interval(days => $2), updated_at=now()
             where id = any($1::text[]) and status = any($3::text[])
             returning id`,
            [ids, data.days ?? 30, statuses],
          );
          updatedIds = res.map((r) => r.id);
          break;
        }
        case "feature": {
          const res = await tx.query<{ id: string }>(
            "update listings set featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => $2) where id = any($1::text[]) and status = any($3::text[]) returning id",
            [ids, data.days ?? 7, statuses],
          );
          updatedIds = res.map((r) => r.id);
          break;
        }
        case "unfeature": {
          const res = await tx.query<{ id: string }>("update listings set featured_until = null where id = any($1::text[]) returning id", [ids]);
          updatedIds = res.map((r) => r.id);
          if (updatedIds.length) {
            await tx.query("update boosts set ends_at = now() where listing_id = any($1::text[]) and kind = 'VITRIN' and ends_at > now()", [updatedIds]);
          }
          break;
        }
        case "move": {
          if (!data.categoryId) throw new Error("Hedef kategori seçin.");
          const cat = await tx.query<{ id: string }>("select id from categories where id = $1", [data.categoryId]);
          if (!cat[0]) throw new Error("Hedef kategori bulunamadı.");
          const res = await tx.query<{ id: string }>("update listings set category_id=$2, updated_at=now() where id = any($1::text[]) returning id", [ids, data.categoryId]);
          updatedIds = res.map((r) => r.id);
          break;
        }
        case "delete": {
          const res = await tx.query<{ id: string }>("delete from listings where id = any($1::text[]) returning id", [ids]);
          updatedIds = res.map((r) => r.id);
          break;
        }
      }

      const updatedSet = new Set(updatedIds);
      const actedRows = rows.filter((r) => updatedSet.has(r.id));
      if (!actedRows.length) throw new Error("Seçili ilanlar bu işleme uygun değil. Başka bir yönetici işlemiş olabilir.");
      return { found, actedRows };
    });

    if (data.action === "delete") {
      const imagesByUser = new Map<string, string[]>();
      for (const r of actedRows) {
        const list = imagesByUser.get(r.user_id) ?? [];
        list.push(...asJson<string[]>(r.images, []));
        imagesByUser.set(r.user_id, list);
      }
      await Promise.all([...imagesByUser.entries()].map(([uid, urls]) => deleteUnusedListingImages(sql, uid, urls)));
    }

    const totalSkipped = found.length - actedRows.length;
    const summary =
      (actedRows.length === 1
        ? `#${actedRows[0].listing_no} "${actedRows[0].title}" ${ACTION_LABEL[data.action]}${reason ? ` — ${reason}` : ""}`
        : `${actedRows.length} ilan ${ACTION_LABEL[data.action]}${reason ? ` — ${reason}` : ""}`) + (totalSkipped ? ` (${totalSkipped} ilan uygun olmadığı için atlandı)` : "");

    await auditMany(
      sql,
      context.adminId,
      actedRows.map((r) => ({
        action: `listing.${data.action}`,
        targetType: "listing",
        targetId: r.id,
        summary: actedRows.length === 1 ? summary : `#${r.listing_no} "${r.title}" ${ACTION_LABEL[data.action]}`,
        meta: {
          reason: reason || undefined,
          days: data.days,
          categoryId: data.categoryId,
          from: r.status,
        },
      })),
    );

    if (data.notify) {
      await Promise.all(
        actedRows.map((r) => {
          const link = `/ilan/${r.slug}`;
          if (data.action === "approve") {
            return notify(r.user_id, "listing", "İlanınız yayında", `"${r.title}" onaylandı ve yayına alındı.`, link);
          }
          if (data.action === "reject") {
            return notify(
              r.user_id,
              "listing",
              "İlanınız reddedildi",
              `"${r.title}" şu gerekçeyle reddedildi: ${reason || "Yayın kurallarına uygun bulunmadı"}. Düzenleyip tekrar onaya gönderebilirsiniz.`,
              link,
            );
          }
          if (data.action === "delete") {
            return notify(r.user_id, "listing", "İlanınız silindi", `"${r.title}" yönetim tarafından silindi.${reason ? ` Gerekçe: ${reason}` : ""}`, "/ilanlarim");
          }
          if (data.action === "sold") {
            return notify(r.user_id, "listing", "İlanınız satıldı olarak işaretlendi", `"${r.title}" yönetim tarafından satıldı olarak işaretlendi.`, link);
          }
          if (data.action === "deactivate") {
            return notify(
              r.user_id,
              "listing",
              "İlanınız yayından kaldırıldı",
              `"${r.title}" yönetim tarafından yayından kaldırıldı.${reason ? ` Gerekçe: ${reason}` : ""}`,
              link,
            );
          }
          return Promise.resolve();
        }),
      );
    }

    if (GOES_LIVE.has(data.action)) {
      const tree = await getCategoryTree();
      for (const r of actedRows) {
        if (r.status === "ACTIVE") continue;
        const cat = tree.byId.get(r.category_id);
        void notifyMatchingSavedSearches(sql, {
          id: r.id,
          title: r.title,
          slug: r.slug,
          categoryId: r.category_id,
          categorySlug: cat?.slug ?? "",
          city: r.city ?? "",
          district: r.district ?? "",
          neighborhood: r.neighborhood ?? null,
          price: num(r.price),
          userId: r.user_id,
          hasImages: asJson<string[]>(r.images, []).length > 0,
          isStore: Boolean(r.store_id),
          attrs: asJson<Record<string, unknown>>(r.attrs, {}),
        }).catch((err) => console.warn("[saved-searches] admin approve notify failed", err));
        void notifySellerFollowers(sql, {
          id: r.id,
          title: r.title,
          slug: r.slug,
          userId: r.user_id,
          sellerName: r.seller_name || "Satıcı",
        }).catch((err) => console.warn("[follows] admin approve notify failed", err));
      }
    }

    return { ok: true as const, count: actedRows.length, summary };
  });

const ALLOWED_UPLOAD_IMG = /^\/uploads\/[-a-zA-Z0-9_.]+\.(webp|jpg|jpeg|png)$/i;
const ALLOWED_MOBILE_IMG = /^\/api\/mobile\/images\/[0-9a-f-]{36}$/i;

function normalizeAdminAttrs(raw: Record<string, unknown>): AttrValues {
  const out: AttrValues = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) out[k] = v.map(String).join(", ");
    else if (typeof v === "number" || typeof v === "string") out[k] = v;
    else if (typeof v === "boolean") out[k] = v ? "Evet" : "Hayır";
    else out[k] = String(v);
  }
  return out;
}

/** Admin correction of the listing text, price, currency, images and attributes. */
export const adminUpdateListing = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      id: z.string().max(200),
      title: z.string().trim().min(5).max(100),
      description: z.string().trim().min(10).max(5000),
      price: z.number().min(1).max(1_000_000_000),
      currency: z.enum(["TRY", "USD", "EUR"]).optional(),
      city: z.string().trim().max(60).optional(),
      district: z.string().trim().max(60).nullish(),
      images: z.array(z.string().max(300)).max(20).optional(),
      attrs: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const preRows = data.attrs !== undefined
      ? await sql.query<{ category_id: string }>("select category_id from listings where id = $1", [data.id])
      : [];
    const attrDefs = data.attrs !== undefined && preRows[0] ? await inheritedAttributes(preRows[0].category_id) : null;
    const { cur, slug, nextCurrency, curImages, nextImages } = await sql.transaction(async (tx) => {
      const rows = await tx.query<{
        user_id: string;
        listing_no: number;
        price: unknown;
        currency: string | null;
        title: string;
        city: string | null;
        district: string | null;
        category_id: string;
        images: unknown;
        attrs: unknown;
      }>(
        "select user_id, listing_no, price, currency, title, city, district, category_id, images, attrs from listings where id = $1 for update",
        [data.id],
      );
      const cur = rows[0];
      if (!cur) throw new Error("İlan bulunamadı.");
      const slug = listingSlug(data.title, cur.listing_no);
      const cityChanged = Boolean(data.city && data.city !== (cur.city ?? ""));
      const nextDistrict = data.district === undefined ? (cityChanged ? null : cur.district) : data.district || null;
      const nextCurrency = data.currency ?? cur.currency ?? "TRY";
      const curImages = asJson<string[]>(cur.images, []);
      const nextImages = data.images ?? curImages;
      if (data.images !== undefined) {
        for (const img of nextImages) {
          if (!curImages.includes(img) && !ALLOWED_UPLOAD_IMG.test(img) && !ALLOWED_MOBILE_IMG.test(img)) {
            throw new Error("Geçersiz görsel.");
          }
        }
      }
      const existingAttrs = asJson<AttrValues>(cur.attrs, {});
      const nextAttrs =
        data.attrs !== undefined
          ? cleanAttrs(normalizeAdminAttrs(data.attrs), attrDefs ?? [], existingAttrs)
          : existingAttrs;

      await tx.query(
        `update listings set title=$2, description=$3, price=$4, currency=$5, slug=$6,
           city=coalesce(nullif($7, ''), city), district=$8,
           images=$9::jsonb, attrs=$10::jsonb, updated_at=now()
         where id=$1`,
        [
          data.id,
          data.title,
          data.description,
          data.price,
          nextCurrency,
          slug,
          data.city ?? "",
          nextDistrict,
          JSON.stringify(nextImages),
          JSON.stringify(nextAttrs),
        ],
      );
      if (num(cur.price) !== data.price) {
        await tx.query("insert into price_history (listing_id, price) values ($1,$2)", [data.id, data.price]);
      }
      return { cur, slug, nextCurrency, curImages, nextImages };
    });
    if (data.images !== undefined) {
      const removed = curImages.filter((img) => !nextImages.includes(img));
      if (removed.length) await deleteUnusedListingImages(sql, cur.user_id, removed);
    }
    await audit(sql, context.adminId, "listing.edit", "listing", data.id, `#${cur.listing_no} ilan bilgileri düzenlendi`, {
      title: cur.title !== data.title ? { from: cur.title, to: data.title } : undefined,
      price: num(cur.price) !== data.price ? { from: num(cur.price), to: data.price } : undefined,
      currency: (cur.currency ?? "TRY") !== nextCurrency ? { from: cur.currency ?? "TRY", to: nextCurrency } : undefined,
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

export const adminCancelBoost = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ boostId: z.string().max(200), listingId: z.string().max(200) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cancelled = await sql.transaction(async (tx) => {
      const rows = await tx.query<{ id: string; kind: string }>(
        "update boosts set ends_at = now() where id = $1 and listing_id = $2 and ends_at > now() returning id, kind",
        [data.boostId, data.listingId],
      );
      if (!rows[0]) throw new Error("Aktif doping bulunamadı.");
      if (rows[0].kind === "VITRIN") {
        const remaining = await tx.query<{ id: string }>(
          "select id from boosts where listing_id = $1 and kind = 'VITRIN' and ends_at > now() limit 1",
          [data.listingId],
        );
        if (!remaining[0]) {
          await tx.query("update listings set featured_until = null where id = $1", [data.listingId]);
        }
      }
      return rows[0];
    });
    await audit(sql, context.adminId, "listing.unboost", "listing", data.listingId, `Doping (${cancelled.kind}) iptal edildi`);
    return { ok: true as const };
  });
