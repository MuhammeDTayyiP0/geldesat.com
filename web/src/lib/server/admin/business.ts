import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { newId, num, slugify } from "@/lib/utils";
import { normalizeTrPhone, notify } from "../helpers";
import { adminMiddleware, audit, likeTerm, paged, paging, PageInput, strOrNull, ts, tsOrNull, Where } from "./common";

/* ───────────────────────────── Stores ───────────────────────────── */

export const STORE_PLANS = ["BASIC", "PRO", "PREMIUM"] as const;

export const adminListStores = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ q: z.string().trim().max(120).optional(), plan: z.string().max(20).optional(), ...PageInput }))
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
                (select count(*) from listings l where l.store_id = s.id and l.status = 'ACTIVE') as active_count
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
    const phone = data.phone ? normalizeTrPhone(data.phone) : null;
    const slugTaken = await sql.query<{ id: string }>("select id from stores where lower(slug) = lower($1) and id <> coalesce($2, '')", [slug, data.id ?? null]);
    if (slugTaken[0]) throw new Error("Bu mağaza adresi kullanılıyor.");

    if (data.id) {
      const cur = (await sql.query<{ name: string; plan: string }>("select name, plan from stores where id = $1", [data.id]))[0];
      if (!cur) throw new Error("Mağaza bulunamadı.");
      await sql.query("update stores set name=$2, slug=$3, description=$4, city=$5, phone=$6, plan=$7 where id=$1", [
        data.id,
        data.name,
        slug,
        data.description || null,
        data.city || null,
        phone,
        data.plan,
      ]);
      await audit(sql, context.adminId, "store.edit", "store", data.id, `Mağaza "${data.name}" düzenlendi${cur.plan !== data.plan ? ` (paket ${cur.plan} → ${data.plan})` : ""}`);
      return { ok: true as const, id: data.id, slug };
    }

    const owner = data.owner?.trim();
    if (!owner) throw new Error("Mağaza sahibinin e-postasını veya kullanıcı kimliğini girin.");
    const found = await sql.query<{ user_id: string; display_name: string }>(
      `select p.user_id, p.display_name from profiles p left join "user" u on u.id = p.user_id
       where p.user_id = $1 or lower(u.email) = lower($1) limit 1`,
      [owner],
    );
    const ownerRow = found[0];
    if (!ownerRow) throw new Error("Bu e-posta veya kimlikle kayıtlı üye bulunamadı.");
    const has = await sql.query<{ id: string }>("select id from stores where user_id = $1", [ownerRow.user_id]);
    if (has[0]) throw new Error("Bu üyenin zaten bir mağazası var.");
    const id = newId("str");
    await sql.query(
      "insert into stores (id, user_id, name, slug, description, city, phone, plan) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, ownerRow.user_id, data.name, slug, data.description || null, data.city || null, phone, data.plan],
    );
    if (data.attachListings) {
      await sql.query("update listings set store_id = $2 where user_id = $1 and store_id is null", [ownerRow.user_id, id]);
    }
    await notify(ownerRow.user_id, "system", "Mağazanız açıldı", `"${data.name}" mağazanız GeldeSat'ta yayında.`, `/satici/${ownerRow.user_id}`);
    await audit(sql, context.adminId, "store.create", "store", id, `${ownerRow.display_name} için "${data.name}" mağazası açıldı (${data.plan})`);
    return { ok: true as const, id, slug };
  });

export const adminDeleteStore = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ id: z.string().max(200) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cur = (await sql.query<{ name: string }>("select name from stores where id = $1", [data.id]))[0];
    if (!cur) throw new Error("Mağaza bulunamadı.");
    // Listings stay with the member; they just lose the store badge (on delete set null).
    await sql.query("delete from stores where id = $1", [data.id]);
    await audit(sql, context.adminId, "store.delete", "store", data.id, `Mağaza "${cur.name}" kapatıldı`);
    return { ok: true as const };
  });

/* ───────────────────────────── Finance ───────────────────────────── */

export const adminListCreditOrders = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ status: z.enum(["ALL", "PENDING", "PAID", "REJECTED", "CANCELLED"]).default("ALL"), q: z.string().trim().max(120).optional(), ...PageInput }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.status !== "ALL") w.add(`o.status = ${w.param(data.status)}`);
    if (data.q) {
      const like = w.param(likeTerm(data.q));
      w.add(`(p.display_name ilike ${like} or u.email ilike ${like} or o.id = ${w.param(data.q)} or o.sku ilike ${like})`);
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
  .validator(z.object({ id: z.string().max(200), status: z.enum(["PAID", "REJECTED"]) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = (await sql.query<{ user_id: string; status: string; credits: number; price: number }>(
      "select user_id, status, credits, price from credit_orders where id = $1",
      [data.id],
    ))[0];
    if (!row) throw new Error("Talep bulunamadı.");
    if (row.status !== "PENDING") throw new Error("Bu talep zaten işlendi.");
    await sql.transaction(async (tx) => {
      await tx.query("update credit_orders set status = $2, resolved_at = now() where id = $1", [data.id, data.status]);
      if (data.status === "PAID") {
        await tx.query("insert into credit_ledger (id, user_id, amount, reason) values ($1,$2,$3,$4)", [
          newId("crd"),
          row.user_id,
          num(row.credits),
          `order:${data.id}`,
        ]);
      }
    });
    if (data.status === "PAID") {
      await notify(row.user_id, "credit", "Krediniz yüklendi", `${row.credits} doping kredisi hesabınıza eklendi.`, "/doping");
    } else {
      await notify(row.user_id, "credit", "Kredi talebi reddedildi", "Havaleniz bulunamadı veya talep iptal edildi. Sorularınız için destek ekibimize yazın.", "/doping");
    }
    await audit(sql, context.adminId, data.status === "PAID" ? "order.paid" : "order.reject", "order", data.id, `${row.credits} kredilik talep ${data.status === "PAID" ? "onaylandı" : "reddedildi"}`);
    return { ok: true as const };
  });

export const adminCreditLedger = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.string().max(200).optional(), ...PageInput }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const w = new Where();
    if (data.userId) w.add(`c.user_id = ${w.param(data.userId)}`);
    const { limit, offset } = paging(data.page, data.pageSize);
    const from = "from credit_ledger c left join profiles p on p.user_id = c.user_id";
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
