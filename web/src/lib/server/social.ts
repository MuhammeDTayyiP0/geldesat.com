import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { asIso, newId } from "@/lib/utils";
import {
  canReviewSeller,
  ensureProfile,
  firstInWindow,
  hasOpenReport,
  mapListing,
  notify,
  rateLimit,
  REVIEW_NOT_ELIGIBLE,
} from "./helpers";
import { sweepExpiryReminders } from "./ops";
import { sweepRetention } from "./retention";
import { sweepMessageDigests } from "./message-digest";
import { unreadMessageCount } from "./chat";

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ listingId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    const ex = await sql.query<{ user_id: string }>(
      "select user_id from favorites where user_id=$1 and listing_id=$2",
      [context.userId, data.listingId],
    );
    if (ex[0]) {
      await sql.query("delete from favorites where user_id=$1 and listing_id=$2", [context.userId, data.listingId]);
      return { favorite: false };
    }
    const owner = await sql.query<{ user_id: string; title: string; slug: string }>(
      "select user_id, title, slug from listings where id=$1 and status='ACTIVE'",
      [data.listingId],
    );
    if (!owner[0]) throw new Error("İlan bulunamadı");
    if (owner[0].user_id === context.userId) throw new Error("Kendi ilanınızı favorilere ekleyemezsiniz.");
    await sql.query("insert into favorites (user_id, listing_id) values ($1,$2) on conflict do nothing", [context.userId, data.listingId]);
    // Toggling on and off must not spam the seller: one notice per user and listing per day.
    if (firstInWindow(`favnotify:${context.userId}:${data.listingId}`, 24 * 60 * 60_000)) {
      await notify(owner[0].user_id, "favorite", "İlanınız favorilendi", owner[0].title, `/ilan/${owner[0].slug}`);
    }
    return { favorite: true };
  });

export const myFavorites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select l.*, c.name as category_name, c.slug as category_slug,
              coalesce((select json_agg(b.kind) from boosts b where b.listing_id = l.id and b.ends_at > now()), '[]'::json) as boosts
       from favorites f
       join listings l on l.id = f.listing_id
       join categories c on c.id = l.category_id
       where f.user_id=$1 and l.status='ACTIVE'
       order by f.created_at desc`,
      [context.userId],
    );
    return rows.map(mapListing);
  });

export const favoriteIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ listing_id: string }>(
      "select listing_id from favorites where user_id=$1",
      [context.userId],
    );
    return rows.map((r) => r.listing_id);
  });

export const reportListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ listingId: z.string(), reason: z.string().min(3).max(80), details: z.string().max(500).optional() }))
  .handler(async ({ context, data }) => {
    rateLimit(`report:${context.userId}`, 10, 60_000);
    const sql = await getSql();
    await ensureProfile(context.userId);
    if (await hasOpenReport(sql, data.listingId, context.userId)) return { ok: true };
    await sql.query(
      "insert into reports (id, listing_id, reporter_id, reason, details) values ($1,$2,$3,$4,$5)",
      [newId("rep"), data.listingId, context.userId, data.reason, data.details || null],
    );
    return { ok: true };
  });

export const leaveReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      sellerId: z.string(),
      listingId: z.string().optional(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (data.sellerId === context.userId) throw new Error("Kendinizi puanlayamazsınız");
    const sql = await getSql();
    await ensureProfile(context.userId);
    if (!(await canReviewSeller(sql, context.userId, data.sellerId))) throw new Error(REVIEW_NOT_ELIGIBLE);
    await sql.query("delete from reviews where seller_id=$1 and reviewer_id=$2 and listing_id is not distinct from $3", [
      data.sellerId,
      context.userId,
      data.listingId || null,
    ]);
    await sql.query(
      `insert into reviews (id, seller_id, reviewer_id, listing_id, rating, comment)
       values ($1,$2,$3,$4,$5,$6)`,
      [newId("rev"), data.sellerId, context.userId, data.listingId || null, data.rating, data.comment || null],
    );
    return { ok: true };
  });

export const checkReviewEligibility = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ sellerId: z.string(), listingId: z.string().optional() }))
  .handler(async ({ context, data }) => {
    if (data.sellerId === context.userId) return { eligible: false, reason: "self", existing: null };
    const sql = await getSql();
    if (!(await canReviewSeller(sql, context.userId, data.sellerId))) {
      return { eligible: false, reason: "not_contacted", existing: null };
    }
    const existing = await sql.query<{ rating: number; comment: string | null }>(
      `select rating, comment from reviews
       where seller_id=$1 and reviewer_id=$2 and listing_id is not distinct from $3
       limit 1`,
      [data.sellerId, context.userId, data.listingId || null],
    );
    return {
      eligible: true,
      reason: null,
      existing: existing[0] ? { rating: Number(existing[0].rating), comment: existing[0].comment } : null,
    };
  });

export const myNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      "select * from notifications where user_id=$1 order by created_at desc limit 50",
      [context.userId],
    );
    return rows.map((n) => ({
      id: String(n.id),
      type: String(n.type),
      title: String(n.title),
      body: n.body ? String(n.body) : "",
      link: n.link ? String(n.link) : "/",
      read: Boolean(n.read_at),
      created_at: asIso(n.created_at),
    }));
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql.query("update notifications set read_at=now() where user_id=$1 and read_at is null", [context.userId]);
    return { ok: true };
  });

export const unreadCount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    void sweepExpiryReminders().catch(() => undefined);
    void sweepRetention().catch((err) => console.warn("[retention] sweep failed", err));
    void sweepMessageDigests().catch((err) => console.warn("[digest] sweep failed", err));
    const sql = await getSql();
    const [a, messages] = await Promise.all([
      sql.query<{ n: number; role: string | null }>(
        `select (select count(*)::int from notifications where user_id=$1 and read_at is null) as n,
                (select role from profiles where user_id=$1) as role`,
        [context.userId],
      ),
      unreadMessageCount(sql, context.userId),
    ]);
    // `admin` rides along so the header needs no separate profile request.
    return { notifications: a[0]?.n ?? 0, messages, admin: a[0]?.role === "ADMIN" };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string() }))
  .handler(async ({ context, data }) => {
    if (data.userId === context.userId) throw new Error("Kendinizi engelleyemezsiniz");
    const sql = await getSql();
    await sql.query(
      "insert into user_blocks (blocker_id, blocked_id) values ($1,$2) on conflict (blocker_id, blocked_id) do nothing",
      [context.userId, data.userId],
    );
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query("delete from user_blocks where blocker_id=$1 and blocked_id=$2", [context.userId, data.userId]);
    return { ok: true };
  });

