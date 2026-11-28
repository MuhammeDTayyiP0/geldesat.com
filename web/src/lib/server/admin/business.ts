import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { liveSql } from "@/lib/listing-status";
import { newId, num, slugify } from "@/lib/utils";
import { normalizeTrPhone, notify } from "../helpers";
import { adminMiddleware, audit, likeTerm, paged, paging, PageInput, strOrNull, ts, tsOrNull, Where } from "./common";

/* ───────────────────────────── Stores ───────────────────────────── */

export const STORE_PLANS = ["BASIC", "PRO", "PREMIUM"] as const;

export const adminListStores = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ q: z.string().trim().max(120).optional(), plan: z.union([z.enum(STORE_PLANS), z.literal("")]).optional(), ...PageInput }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.plan) w.add(`s.plan = ${w.param(data.plan)}`);
    if (data.q) {
      const like = w.param(likeTerm(data.q));
      w.add(`(s.name ilike ${like} or s.slug ilike ${like} or p.display_name ilike ${like} or u.email ilike ${like} or s.city ilike ${like})`);
    }
    const from = `from stores s left join profiles p on p.user_id = s.user_id left join "user" u on u.id = s.user_id`;
    const { limit, offset } = paging(data.page, data.pageSize);
    const [rows, count] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select s.*, coalesce(p.display_name, 'Üye') as owner_name, u.email as owner_email, (p.banned_at is not null) as owner_banned,
                (select count(*) from listings l where l.store_id = s.id) as listing_count,
                (select count(*) from listings l where l.store_id = s.id and ${liveSql()}) as active_count
         ${from} ${w.sql} order by s.created_at desc limit ${limit} offset ${offset}`,
        w.params,
      ),
      sql.query<{ n: number }>(`select count(*) as n ${from} ${w.sql}`, w.params),
    ]);
    return paged(
      rows.map((r) => ({
        id: String(r.id),
        user_id: String(r.user_id),
        name: String(r.name),
        slug: String(r.slug),
        description: strOrNull(r.description),
        city: strOrNull(r.city),
        phone: strOrNull(r.phone),
        plan: String(r.plan),
        created_at: ts(r.created_at),
        owner_name: String(r.owner_name),
        owner_email: strOrNull(r.owner_email),
        owner_banned: Boolean(r.owner_banned),
        listing_count: num(r.listing_count),
        active_count: num(r.active_count),
      })),
      num(count[0]?.n),
      data.page,
      data.pageSize,
    );
  });

export type AdminStoreRow = Awaited<ReturnType<typeof adminListStores>>["rows"][number];

function isUniqueError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

function normalizeStorePhone(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  try {
    return normalizeTrPhone(raw);
  } catch {
    const digits = raw.replace(/\D/g, "");
    if (/^0\d{10}$/.test(digits)) return digits;
    if (/^90\d{10}$/.test(digits)) return `0${digits.slice(2)}`;
    throw new Error("Geçerli bir Türkiye telefon numarası girin.");
  }
}

/** Stores are opened by the team: create one for a member (by e-mail or id), or edit it. */
export const adminSaveStore = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      id: z.string().max(200).optional(),
      owner: z.string().trim().max(200).optional(),
      name: z.string().trim().min(3).max(60),
      slug: z.string().trim().max(80).optional(),
      description: z.string().trim().max(400).optional(),
      city: z.string().trim().max(40).optional(),
      phone: z.string().trim().max(20).optional(),
      plan: z.enum(STORE_PLANS),
      attachListings: z.boolean().default(true),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const slug = slugify(data.slug || data.name);
    if (!slug) throw new Error("Geçerli bir mağaza adresi girin.");
    const phone = data.phone ? normalizeStorePhone(data.phone) : null;

    if (data.id) {
      const cur = await sql.transaction(async (tx) => {
        const slugTaken = await tx.query<{ id: string }>(
          "select id from stores where lower(slug) = lower($1) and id <> $2",
          [slug, data.id],
        );
        if (slugTaken[0]) throw new Error("Bu mağaza adresi kullanılıyor.");
        const existing = (await tx.query<{ name: string; plan: string }>("select name, plan from stores where id = $1 for update", [data.id]))[0];
        if (!existing) throw new Error("Mağaza bulunamadı.");
        try {
          await tx.query("update stores set name=$2, slug=$3, description=$4, city=$5, phone=$6, plan=$7 where id=$1", [
            data.id,
            data.name,
            slug,
            data.description || null,
            data.city || null,
            phone,
            data.plan,
          ]);
        } catch (err) {
          if (isUniqueError(err)) throw new Error("Bu mağaza adresi kullanılıyor.");
          throw err;
        }
        return existing;
      });
      await audit(sql, context.adminId, "store.edit", "store", data.id, `Mağaza "${data.name}" düzenlendi${cur.plan !== data.plan ? ` (paket ${cur.plan} → ${data.plan})` : ""}`);
      return { ok: true as const, id: data.id, slug };
    }

    const owner = data.owner?.trim();
    if (!owner) throw new Error("Mağaza sahibinin e-postasını veya kullanıcı kimliğini girin.");
    const { id, ownerRow } = await sql.transaction(async (tx) => {
      const slugTaken = await tx.query<{ id: string }>("select id from stores where lower(slug) = lower($1)", [slug]);
      if (slugTaken[0]) throw new Error("Bu mağaza adresi kullanılıyor.");
      const found = await tx.query<{ user_id: string; display_name: string; banned_at: unknown; deletion_requested_at: unknown }>(
        `select p.user_id, p.display_name, p.banned_at, p.deletion_requested_at
         from profiles p left join "user" u on u.id = p.user_id
         where p.user_id = $1 or lower(u.email) = lower($1) limit 1`,
        [owner],
      );
      const user = found[0];
      if (!user) throw new Error("Bu e-posta veya kimlikle kayıtlı üye bulunamadı.");
      if (user.banned_at || user.deletion_requested_at) {
        throw new Error("Askıda olan veya silinme sürecindeki üye için mağaza açılamaz.");
      }
      const has = await tx.query<{ id: string }>("select id from stores where user_id = $1", [user.user_id]);
      if (has[0]) throw new Error("Bu üyenin zaten bir mağazası var.");
      const newStoreId = newId("str");
      try {
        await tx.query(
          "insert into stores (id, user_id, name, slug, description, city, phone, plan) values ($1,$2,$3,$4,$5,$6,$7,$8)",
          [newStoreId, user.user_id, data.name, slug, data.description || null, data.city || null, phone, data.plan],
        );
      } catch (err) {
        if (isUniqueError(err)) throw new Error("Bu mağaza adresi veya üye mağazası zaten mevcut.");
        throw err;
      }
      if (data.attachListings) {
        await tx.query("update listings set store_id = $2 where user_id = $1 and store_id is null", [user.user_id, newStoreId]);
      }
      await tx.query("update profiles set account_type = 'CORPORATE' where user_id = $1", [user.user_id]);
      return { id: newStoreId, ownerRow: user };
    });
    await notify(ownerRow.user_id, "system", "Mağazanız açıldı", `"${data.name}" mağazanız GeldeSat'ta yayında.`, `/satici/${ownerRow.user_id}`);
    await audit(sql, context.adminId, "store.create", "store", id, `${ownerRow.display_name} için "${data.name}" mağazası açıldı (${data.plan})`);
    return { ok: true as const, id, slug };
  });

export const adminDeleteStore = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ id: z.string().max(200) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    // Listings stay with the member; they just lose the store badge (on delete set null).
    const cur = (
      await sql.query<Record<string, unknown> & { name: string; user_id: string }>(
        "delete from stores where id = $1 returning *",
        [data.id],
      )
    )[0];
    if (!cur) throw new Error("Mağaza bulunamadı.");
    await sql.query("update profiles set account_type = 'INDIVIDUAL' where user_id = $1", [cur.user_id]);
    await audit(sql, context.adminId, "store.delete", "store", data.id, `Mağaza "${cur.name}" kapatıldı`, {
      owner: cur.user_id,
      slug: cur.slug,
      plan: cur.plan,
      city: cur.city,
    });
    await notify(cur.user_id, "system", "Mağazanız kapatıldı", `"${cur.name}" mağazanız kapatıldı. İlanlarınız yayında kalır. Sorularınız için destek ekibine yazın.`, "/ayarlar/magaza");
    return { ok: true as const };
  });

export const adminListStoreApplications = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).default("ALL"),
      q: z.string().trim().max(120).optional(),
      ...PageInput,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.status !== "ALL") w.add(`a.status = ${w.param(data.status)}`);
    if (data.q) {
      const like = w.param(likeTerm(data.q));
      w.add(
        `(a.name ilike ${like} or a.city ilike ${like} or a.tax_no ilike ${like} or a.tax_office ilike ${like} or a.sector ilike ${like} or p.display_name ilike ${like} or u.email ilike ${like} or a.id = ${w.param(data.q)})`,
      );
    }
    const from = `
      from store_applications a
      left join profiles p on p.user_id = a.user_id
      left join "user" u on u.id = a.user_id
      left join profiles rb on rb.user_id = a.reviewed_by
      left join stores s on s.user_id = a.user_id`;
    const { limit, offset } = paging(data.page, data.pageSize);
    const [rows, count, totals] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select a.id, a.user_id, a.name, a.business_type, a.sector, a.tax_office, a.address, a.city, a.phone, a.tax_no, a.notes, a.status,
                a.reviewed_by, a.review_note, a.created_at, a.reviewed_at,
                coalesce(p.display_name, 'Üye') as applicant_name,
                u.email as applicant_email,
                p.avatar_url as applicant_avatar,
                (p.banned_at is not null) as applicant_banned,
                (p.deletion_requested_at is not null) as applicant_closing,
                rb.display_name as reviewed_by_name,
                s.id as existing_store_id,
                s.slug as existing_store_slug
         ${from} ${w.sql}
         order by (a.status = 'PENDING') desc, a.created_at desc
         limit ${limit} offset ${offset}`,
        w.params,
      ),
      sql.query<{ n: number }>(`select count(*) as n ${from} ${w.sql}`, w.params),
      sql.query<Record<string, unknown>>(
        `select count(*) as all,
                count(*) filter (where status = 'PENDING') as pending,
                count(*) filter (where status = 'APPROVED') as approved,
                count(*) filter (where status = 'REJECTED') as rejected
         from store_applications`,
      ),
    ]);
    const t = totals[0] ?? {};
    return {
      ...paged(
        rows.map((r) => ({
          id: String(r.id),
          user_id: String(r.user_id),
          name: String(r.name),
          business_type: strOrNull(r.business_type),
          sector: strOrNull(r.sector),
          tax_office: strOrNull(r.tax_office),
          address: strOrNull(r.address),
          city: strOrNull(r.city),
          phone: strOrNull(r.phone),
          tax_no: strOrNull(r.tax_no),
          notes: strOrNull(r.notes),
          status: String(r.status),
          reviewed_by: strOrNull(r.reviewed_by),
          reviewed_by_name: strOrNull(r.reviewed_by_name),
          review_note: strOrNull(r.review_note),
          created_at: ts(r.created_at),
          reviewed_at: tsOrNull(r.reviewed_at),
          applicant_name: String(r.applicant_name),
          applicant_email: strOrNull(r.applicant_email),
          applicant_avatar: strOrNull(r.applicant_avatar),
          applicant_banned: Boolean(r.applicant_banned),
          applicant_closing: Boolean(r.applicant_closing),
          existing_store_id: strOrNull(r.existing_store_id),
          existing_store_slug: strOrNull(r.existing_store_slug),
        })),
        num(count[0]?.n),
        data.page,
        data.pageSize,
      ),
      totals: {
        all: num(t.all),
        pending: num(t.pending),
        approved: num(t.approved),
        rejected: num(t.rejected),
      },
    };
  });

export type AdminStoreApplicationRow = Awaited<ReturnType<typeof adminListStoreApplications>>["rows"][number];

export const adminResolveStoreApplication = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      id: z.string().max(200),
      action: z.enum(["approve", "reject"]),
      plan: z.enum(STORE_PLANS).default("BASIC"),
      note: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const reviewNote = data.note?.trim() || null;
    const nextStatus = data.action === "approve" ? "APPROVED" : "REJECTED";

    const result = await sql.transaction(async (tx) => {
      const app = (
        await tx.query<{
          id: string;
          user_id: string;
          name: string;
          business_type: string | null;
          sector: string | null;
          tax_office: string | null;
          tax_no: string | null;
          address: string | null;
          city: string | null;
          phone: string | null;
          status: string;
        }>(
          "select id, user_id, name, business_type, sector, tax_office, tax_no, address, city, phone, status from store_applications where id = $1 for update",
          [data.id],
        )
      )[0];
      if (!app) throw new Error("Mağaza başvurusu bulunamadı.");
      if (app.status !== "PENDING") throw new Error("Bu başvuru zaten sonuçlandırıldı.");

      await tx.query(
        "update store_applications set status = $2, reviewed_by = $3, review_note = $4, reviewed_at = now() where id = $1",
        [app.id, nextStatus, context.adminId, reviewNote],
      );

      let storeId: string | null = null;
      let storeSlug: string | null = null;
      if (data.action === "approve") {
        const applicantProfile = (
          await tx.query<{ banned_at: unknown; deletion_requested_at: unknown }>(
            "select banned_at, deletion_requested_at from profiles where user_id = $1",
            [app.user_id],
          )
        )[0];
        if (!applicantProfile || applicantProfile.banned_at || applicantProfile.deletion_requested_at) {
          throw new Error("Askıda olan veya silinme sürecindeki üyenin mağaza başvurusu onaylanamaz.");
        }
        const existing = (
          await tx.query<{ id: string; slug: string }>("select id, slug from stores where user_id = $1 limit 1", [app.user_id])
        )[0];
        if (existing) {
          await tx.query("update stores set plan = $2 where id = $1", [existing.id, data.plan]);
          storeId = existing.id;
          storeSlug = existing.slug;
        } else {
          const baseSlug = slugify(app.name) || "magaza";
          const normalizedPhone = normalizeStorePhone(app.phone);
          let inserted: { id: string; slug: string }[] = [];
          for (let attempt = 0; attempt < 6; attempt++) {
            let candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
            if (attempt === 5) candidate = `${baseSlug}-${newId().slice(0, 6)}`;
            const taken = await tx.query<{ id: string }>("select id from stores where lower(slug) = lower($1) limit 1", [candidate]);
            if (taken[0]) continue;
            const newStoreId = newId("str");
            await tx.query("savepoint sp_store_insert");
            try {
              inserted = await tx.query<{ id: string; slug: string }>(
                `insert into stores (id, user_id, name, slug, business_type, sector, tax_office, tax_no, address, city, phone, plan)
                 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 on conflict (user_id) do nothing
                 returning id, slug`,
                [
                  newStoreId,
                  app.user_id,
                  app.name,
                  candidate,
                  app.business_type,
                  app.sector,
                  app.tax_office,
                  app.tax_no,
                  app.address,
                  app.city || null,
                  normalizedPhone,
                  data.plan,
                ],
              );
              await tx.query("release savepoint sp_store_insert");
              break;
            } catch (err) {
              await tx.query("rollback to savepoint sp_store_insert");
              if (isUniqueError(err) && attempt < 5) continue;
              throw err;
            }
          }
          if (inserted[0]) {
            storeId = inserted[0].id;
            storeSlug = inserted[0].slug;
            await tx.query("update listings set store_id = $2 where user_id = $1 and store_id is null", [app.user_id, storeId]);
          } else {
            const fallback = (
              await tx.query<{ id: string; slug: string }>("select id, slug from stores where user_id = $1 limit 1", [app.user_id])
            )[0];
            if (!fallback) throw new Error("Mağaza oluşturulamadı, lütfen tekrar deneyin.");
            storeId = fallback.id;
            storeSlug = fallback.slug;
          }
        }
        await tx.query("update profiles set account_type = 'CORPORATE' where user_id = $1", [app.user_id]);
      }

      return { app, storeId, storeSlug };
    });

    if (data.action === "approve") {
      await audit(
        sql,
        context.adminId,
        "store.application.approve",
        "store",
        result.storeId ?? result.app.id,
        `"${result.app.name}" mağaza başvurusu onaylandı (${data.plan})`,
        { applicationId: result.app.id, userId: result.app.user_id, plan: data.plan, note: reviewNote ?? undefined },
      );
      await notify(
        result.app.user_id,
        "system",
        "Mağaza başvurunuz onaylandı",
        `"${result.app.name}" mağaza başvurunuz onaylandı ve mağazanız açıldı.`,
        "/ayarlar/magaza",
      );
    } else {
      await audit(
        sql,
        context.adminId,
        "store.application.reject",
        "store",
        result.app.id,
        `"${result.app.name}" mağaza başvurusu reddedildi${reviewNote ? ` — ${reviewNote}` : ""}`,
        { applicationId: result.app.id, userId: result.app.user_id, note: reviewNote ?? undefined },
      );
      await notify(
        result.app.user_id,
        "system",
        "Mağaza başvurunuz reddedildi",
        reviewNote
          ? `"${result.app.name}" mağaza başvurunuz reddedildi. Gerekçe: ${reviewNote}`
          : `"${result.app.name}" mağaza başvurunuz uygun bulunmadı.`,
        "/ayarlar/magaza",
      );
    }

    return { ok: true as const, status: nextStatus, storeId: result.storeId, slug: result.storeSlug };
  });

/* ───────────────────────────── Finance ───────────────────────────── */

function likePrefix(q: string): string {
  return `${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

export const adminListCreditOrders = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ status: z.enum(["ALL", "PENDING", "PAID", "REJECTED", "CANCELLED"]).default("ALL"), q: z.string().trim().max(120).optional(), ...PageInput }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.status !== "ALL") w.add(`o.status = ${w.param(data.status)}`);
    if (data.q) {
      const like = w.param(likeTerm(data.q));
      const prefix = w.param(likePrefix(data.q));
      w.add(`(p.display_name ilike ${like} or u.email ilike ${like} or o.id ilike ${prefix} or o.sku ilike ${like})`);
    }
    const from = `from credit_orders o left join profiles p on p.user_id = o.user_id left join "user" u on u.id = o.user_id`;
    const { limit, offset } = paging(data.page, data.pageSize);
    const [rows, count, totals] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select o.*, coalesce(p.display_name, 'Üye') as buyer_name, u.email as buyer_email
         ${from} ${w.sql} order by (o.status = 'PENDING') desc, o.created_at desc limit ${limit} offset ${offset}`,
        w.params,
      ),
      sql.query<{ n: number }>(`select count(*) as n ${from} ${w.sql}`, w.params),
      sql.query<Record<string, unknown>>(
        `select count(*) filter (where status='PENDING') as pending,
                coalesce(sum(price) filter (where status='PAID'), 0) as revenue,
                coalesce(sum(price) filter (where status='PAID' and resolved_at > now() - interval '30 days'), 0) as revenue_30d,
                coalesce(sum(credits) filter (where status='PAID'), 0) as credits_sold
         from credit_orders`,
      ),
    ]);
    const t = totals[0] ?? {};
    return {
      ...paged(
        rows.map((r) => ({
          id: String(r.id),
          user_id: String(r.user_id),
          buyer_name: String(r.buyer_name),
          buyer_email: strOrNull(r.buyer_email),
          sku: String(r.sku),
          credits: num(r.credits),
          price: num(r.price),
          status: String(r.status),
          created_at: ts(r.created_at),
          resolved_at: tsOrNull(r.resolved_at),
        })),
        num(count[0]?.n),
        data.page,
        data.pageSize,
      ),
      totals: { pending: num(t.pending), revenue: num(t.revenue), revenue_30d: num(t.revenue_30d), credits_sold: num(t.credits_sold) },
    };
  });

export const adminResolveCreditOrder = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      id: z.string().max(200),
      status: z.enum(["PAID", "REJECTED"]),
      reason: z.string().trim().max(200).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const reason = data.reason?.trim() || undefined;
    // Claiming the order in one conditional update stops a second approval, or
    // the member's cancellation, from racing this one.
    const row = await sql.transaction(async (tx) => {
      const target = (await tx.query<{ user_id: string }>("select user_id from credit_orders where id = $1 for update", [data.id]))[0];
      if (!target) throw new Error("Bu talep bulunamadı veya zaten işlendi.");
      if (target.user_id === context.adminId) {
        throw new Error("Kendi kredi talebinizi onaylayamaz veya reddedemezsiniz.");
      }
      const claimed = (await tx.query<{ user_id: string; credits: number; price: number }>(
        "update credit_orders set status = $2, resolved_at = now() where id = $1 and status = 'PENDING' returning user_id, credits, price",
        [data.id, data.status],
      ))[0];
      if (!claimed) throw new Error("Bu talep bulunamadı veya zaten işlendi.");
      if (data.status === "PAID") {
        await tx.query("insert into credit_ledger (id, user_id, amount, reason) values ($1,$2,$3,$4)", [
          newId("crd"),
          claimed.user_id,
          num(claimed.credits),
          `order:${data.id}`,
        ]);
      }
      return claimed;
    });
    if (data.status === "PAID") {
      await notify(row.user_id, "credit", "Krediniz yüklendi", `${row.credits} doping kredisi hesabınıza eklendi.`, "/doping");
    } else {
      await notify(
        row.user_id,
        "credit",
        "Kredi talebi reddedildi",
        reason
          ? `Kredi talebiniz reddedildi. Gerekçe: ${reason}`
          : "Havaleniz bulunamadı veya talep iptal edildi. Sorularınız için destek ekibimize yazın.",
        "/doping",
      );
    }
    await audit(
      sql,
      context.adminId,
      data.status === "PAID" ? "order.paid" : "order.reject",
      "order",
      data.id,
      `${row.credits} kredilik talep (${row.price} TL) ${data.status === "PAID" ? "onaylandı" : "reddedildi"}${reason ? ` — ${reason}` : ""}`,
      reason ? { reason } : undefined,
    );
    return { ok: true as const };
  });

export const adminCreditLedger = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      userId: z.string().max(200).optional(),
      q: z.string().trim().max(120).optional(),
      kind: z.enum(["all", "in", "out"]).default("all"),
      ...PageInput,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.userId) w.add(`c.user_id = ${w.param(data.userId)}`);
    if (data.kind === "in") w.add("c.amount > 0");
    if (data.kind === "out") w.add("c.amount < 0");
    if (data.q) {
      const like = w.param(likeTerm(data.q));
      w.add(`(p.display_name ilike ${like} or u.email ilike ${like} or c.reason ilike ${like} or c.user_id = ${w.param(data.q)})`);
    }
    const { limit, offset } = paging(data.page, data.pageSize);
    const from = 'from credit_ledger c left join profiles p on p.user_id = c.user_id left join "user" u on u.id = c.user_id';
    const [rows, count] = await Promise.all([
      sql.query<Record<string, unknown>>(
        `select c.*, coalesce(p.display_name, 'Üye') as user_name ${from} ${w.sql} order by c.created_at desc limit ${limit} offset ${offset}`,
        w.params,
      ),
      sql.query<{ n: number }>(`select count(*) as n ${from} ${w.sql}`, w.params),
    ]);
    return paged(
      rows.map((r) => ({
        id: String(r.id),
        user_id: String(r.user_id),
        user_name: String(r.user_name),
        amount: num(r.amount),
        reason: String(r.reason),
        created_at: ts(r.created_at),
      })),
      num(count[0]?.n),
      data.page,
      data.pageSize,
    );
  });
