import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { num } from "@/lib/utils";
import { notify } from "../helpers";
import { adminMiddleware, audit, likeTerm, paged, paging, PageInput, strOrNull, ts, tsOrNull, Where } from "./common";

/* ───────────────────────────── Reports ───────────────────────────── */

const ReportFilter = z.object({
  status: z.enum(["ALL", "OPEN", "CLOSED"]).default("OPEN"),
  kind: z.enum(["all", "listing", "conversation"]).default("all"),
  q: z.string().trim().max(120).optional(),
  ...PageInput,
});

export const adminListReports = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(ReportFilter)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.status !== "ALL") w.add(`r.status = ${w.param(data.status)}`);
    if (data.kind === "listing") w.add("r.conversation_id is null");
    if (data.kind === "conversation") w.add("r.conversation_id is not null");
    if (data.q) {
      const like = w.param(likeTerm(data.q));
      w.add(`(r.reason ilike ${like} or r.details ilike ${like} or l.title ilike ${like} or rp.display_name ilike ${like})`);
    }
    const from = `
      from reports r
      left join listings l on l.id = r.listing_id
      left join profiles rp on rp.user_id = r.reporter_id
      left join profiles op on op.user_id = l.user_id
      left join conversations cv on cv.id = r.conversation_id
      left join profiles rb on rb.user_id = r.resolved_by`;
    const { limit, offset } = paging(data.page, data.pageSize);
    const [rows, count, totals] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select r.id, r.listing_id, r.reason, r.details, r.status, r.created_at, r.conversation_id, r.message_id, r.reporter_id,
                r.resolved_at, r.resolution_note, coalesce(rb.display_name, null) as resolved_by_name,
                l.title, l.slug, l.listing_no, l.status as listing_status, l.user_id as owner_id,
                case when l.id is not null and jsonb_array_length(l.images) > 0 then l.images->>0 end as cover,
                coalesce(rp.display_name, 'Üye') as reporter_name, op.display_name as owner_name, (op.banned_at is not null) as owner_banned,
                cv.buyer_id, cv.seller_id,
                (select count(*) from reports r2 where r2.listing_id = r.listing_id and r.listing_id is not null) as same_listing_reports
         ${from} ${w.sql} order by (r.status = 'OPEN') desc, r.created_at desc limit ${limit} offset ${offset}`,
        w.params,
      ),
      sql.query<{ n: number }>(`select count(*) as n ${from} ${w.sql}`, w.params),
      sql.query<Record<string, unknown>>(
        `select count(*) filter (where status='OPEN') as open, count(*) filter (where status='CLOSED') as closed, count(*) as all from reports`,
      ),
    ]);

    // Conversation reports carry the reported message, or the last messages,
    // so moderators can judge them; the reporter chose to share that chat.
    const excerpts = new Map<string, Array<{ who: string; text: string; at: string; reported: boolean }>>();
    const partyNames = new Map<string, string>();
    for (const r of rows.filter((x) => x.conversation_id)) {
      const msgs = await sql.query<{ id: string; sender_id: string; content: string; created_at: unknown }>(
        `select * from (
           select id, sender_id, content, created_at from messages
           where conversation_id = $1 and deleted_at is null order by created_at desc limit 12
         ) m order by created_at`,
        [r.conversation_id],
      );
      excerpts.set(
        String(r.id),
        msgs.map((m) => ({
          who: m.sender_id === r.reporter_id ? "Şikayet eden" : "Karşı taraf",
          text: m.content,
          at: ts(m.created_at),
          reported: m.id === r.message_id,
        })),
      );
      const other = r.buyer_id === r.reporter_id ? r.seller_id : r.buyer_id;
      if (other) {
        const p = await sql.query<{ display_name: string }>("select display_name from profiles where user_id = $1", [other]);
        partyNames.set(String(r.id), p[0]?.display_name ?? "Silinmiş kullanıcı");
      }
    }

    const t = totals[0] ?? {};
    return {
      ...paged(
        rows.map((r) => {
          const otherParty = r.conversation_id ? (r.buyer_id === r.reporter_id ? strOrNull(r.seller_id) : strOrNull(r.buyer_id)) : strOrNull(r.owner_id);
          return {
            id: String(r.id),
            kind: r.conversation_id ? ("conversation" as const) : ("listing" as const),
            reason: String(r.reason),
            details: strOrNull(r.details),
            status: String(r.status),
            created_at: ts(r.created_at),
            resolved_at: tsOrNull(r.resolved_at),
            resolution_note: strOrNull(r.resolution_note),
            resolved_by_name: strOrNull(r.resolved_by_name),
            reporter_id: String(r.reporter_id),
            reporter_name: String(r.reporter_name),
            listing_id: strOrNull(r.listing_id),
            listing_title: strOrNull(r.title),
            listing_slug: strOrNull(r.slug),
            listing_no: num(r.listing_no),
            listing_status: strOrNull(r.listing_status),
            cover: strOrNull(r.cover),
            reported_user_id: otherParty,
            reported_user_name: r.conversation_id ? (partyNames.get(String(r.id)) ?? null) : strOrNull(r.owner_name),
            reported_user_banned: Boolean(r.owner_banned),
            same_listing_reports: num(r.same_listing_reports),
            messages: excerpts.get(String(r.id)) ?? [],
          };
        }),
        num(count[0]?.n),
        data.page,
        data.pageSize,
      ),
      totals: { OPEN: num(t.open), CLOSED: num(t.closed), ALL: num(t.all) },
    };
  });

export type AdminReportRow = Awaited<ReturnType<typeof adminListReports>>["rows"][number];

/**
 * Close or reopen reports, optionally acting on what was reported in the same
 * step: take the listing down (rejected, owner notified) or suspend the reported member.
 */
export const adminResolveReports = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      ids: z.array(z.string().max(200)).min(1).max(200),
      status: z.enum(["OPEN", "CLOSED"]),
      note: z.string().trim().max(500).optional(),
      takeDownListing: z.boolean().default(false),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const note = data.note?.trim() || null;
    const rows = await sql.query<{ id: string; listing_id: string | null; reason: string }>(
      "select id, listing_id, reason from reports where id = any($1::text[])",
      [data.ids],
    );
    if (data.status === "CLOSED") {
      await sql.query(
        "update reports set status = 'CLOSED', resolved_at = now(), resolved_by = $2, resolution_note = coalesce($3, resolution_note) where id = any($1::text[])",
        [data.ids, context.adminId, note],
      );
    } else {
      await sql.query("update reports set status = 'OPEN', resolved_at = null, resolved_by = null where id = any($1::text[])", [data.ids]);
    }
    let takenDown = 0;
    if (data.takeDownListing && data.status === "CLOSED") {
      const listingIds = [...new Set(rows.map((r) => r.listing_id).filter((x): x is string => Boolean(x)))];
      if (listingIds.length) {
        const listings = await sql.query<{ id: string; user_id: string; title: string; slug: string; listing_no: number }>(
          `update listings set status = 'REJECTED', approved_at = null, updated_at = now()
           where id = any($1::text[]) and status <> 'REJECTED'
           returning id, user_id, title, slug, listing_no`,
          [listingIds],
        );
        takenDown = listings.length;
        for (const l of listings) {
          const why = note || rows.find((r) => r.listing_id === l.id)?.reason || "Yayın kurallarına aykırılık";
          await notify(l.user_id, "listing", "İlanınız yayından kaldırıldı", `"${l.title}" şikayet incelemesi sonucunda kaldırıldı. Gerekçe: ${why}`, `/ilan/${l.slug}`);
          await audit(sql, context.adminId, "listing.reject", "listing", l.id, `#${l.listing_no} "${l.title}" şikayet üzerine kaldırıldı — ${why}`);
        }
      }
    }
    for (const r of rows) {
      await audit(
        sql,
        context.adminId,
        data.status === "CLOSED" ? "report.close" : "report.reopen",
        "report",
        r.id,
        `Şikayet (${r.reason}) ${data.status === "CLOSED" ? "kapatıldı" : "yeniden açıldı"}${note ? ` — ${note}` : ""}`,
      );
    }
    return { ok: true as const, count: rows.length, takenDown };
  });

/* ───────────────────────────── Reviews ───────────────────────────── */

export const adminListReviews = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      q: z.string().trim().max(120).optional(),
      rating: z.number().int().min(0).max(5).default(0),
      ...PageInput,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.rating) w.add(`r.rating = ${w.param(data.rating)}`);
    if (data.q) {
      const like = w.param(likeTerm(data.q));
      w.add(`(r.comment ilike ${like} or sp.display_name ilike ${like} or rp.display_name ilike ${like})`);
    }
    const from = `
      from reviews r
      left join profiles sp on sp.user_id = r.seller_id
      left join profiles rp on rp.user_id = r.reviewer_id
      left join listings l on l.id = r.listing_id`;
    const { limit, offset } = paging(data.page, data.pageSize);
    const [rows, count, dist] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select r.id, r.rating, r.comment, r.created_at, r.seller_id, r.reviewer_id,
                coalesce(sp.display_name, 'Silinmiş kullanıcı') as seller_name,
                coalesce(rp.display_name, 'Silinmiş kullanıcı') as reviewer_name,
                l.title as listing_title, l.listing_no
         ${from} ${w.sql} order by r.created_at desc limit ${limit} offset ${offset}`,
        w.params,
      ),
      sql.query<{ n: number }>(`select count(*) as n ${from} ${w.sql}`, w.params),
      sql.query<{ rating: number; n: number }>("select rating, count(*) as n from reviews group by rating"),
    ]);
    return {
      ...paged(
        rows.map((r) => ({
          id: String(r.id),
          rating: num(r.rating),
          comment: strOrNull(r.comment),
          created_at: ts(r.created_at),
          seller_id: String(r.seller_id),
          reviewer_id: String(r.reviewer_id),
          seller_name: String(r.seller_name),
          reviewer_name: String(r.reviewer_name),
          listing_title: strOrNull(r.listing_title),
          listing_no: num(r.listing_no),
        })),
        num(count[0]?.n),
        data.page,
        data.pageSize,
      ),
      distribution: Object.fromEntries(dist.map((d) => [num(d.rating), num(d.n)])) as Record<number, number>,
    };
  });

export const adminDeleteReviews = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ ids: z.array(z.string().max(200)).min(1).max(200), reason: z.string().trim().max(300).optional() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string; rating: number; comment: string | null }>(
      "delete from reviews where id = any($1::text[]) returning id, rating, comment",
      [data.ids],
    );
    for (const r of rows) {
      await audit(sql, context.adminId, "review.delete", "review", r.id, `${r.rating}★ yorum silindi${data.reason ? ` — ${data.reason}` : ""}`, {
        comment: r.comment?.slice(0, 200),
      });
    }
    return { ok: true as const, count: rows.length };
  });
