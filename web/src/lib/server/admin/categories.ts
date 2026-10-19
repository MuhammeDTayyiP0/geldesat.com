import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { asJson, num, slugify } from "@/lib/utils";
import { adminMiddleware, audit } from "./common";

type QuerySql = Pick<Sql, "query">;

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon: string | null;
  sort_order: number;
  /** Listings filed directly under this category (any status). */
  listings: number;
  /** Live listings filed directly under this category. */
  live: number;
  /** Attributes attached directly to this category. */
  attrs: number;
};

/** The whole tree with per-node counts; the client sums subtrees. */
export const adminCategoryTree = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const [rows, counts, attrs] = await Promise.all([
      sql.query<{ id: string; name: string; slug: string; parent_id: string | null; icon: string | null; sort_order: number }>(
        "select id, name, slug, parent_id, icon, sort_order from categories",
      ),
      sql.query<{ category_id: string; total: number; live: number }>(
        `select category_id, count(*) as total,
                count(*) filter (where status = 'ACTIVE' and (expires_at is null or expires_at > now())) as live
         from listings group by category_id`,
      ),
      sql.query<{ category_id: string; n: number }>("select category_id, count(*) as n from category_attributes group by category_id"),
    ]);
    const countMap = new Map(counts.map((c) => [c.category_id, c]));
    const attrMap = new Map(attrs.map((a) => [a.category_id, num(a.n)]));
    const categories: AdminCategory[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      parent_id: r.parent_id,
      icon: r.icon,
      sort_order: num(r.sort_order),
      listings: num(countMap.get(r.id)?.total),
      live: num(countMap.get(r.id)?.live),
      attrs: attrMap.get(r.id) ?? 0,
    }));
    return { categories };
  });

async function subtree(sql: QuerySql, id: string): Promise<string[]> {
  const rows = await sql.query<{ id: string }>(
    `with recursive t as (
       select id from categories where id = $1
       union all
       select c.id from categories c join t on c.parent_id = t.id
     ) select id from t`,
    [id],
  );
  return rows.map((r) => r.id);
}

async function pathOf(sql: QuerySql, id: string): Promise<Array<{ id: string; name: string }>> {
  return sql.query<{ id: string; name: string }>(
    `with recursive chain as (
       select id, name, parent_id, 0 as depth from categories where id = $1
       union all
       select c.id, c.name, c.parent_id, ch.depth + 1 from categories c join chain ch on ch.parent_id = c.id
     ) select id, name from chain order by depth desc`,
    [id],
  );
}

/** Writes sort_order 1..n in the given order, in one statement. */
async function renumber(sql: QuerySql, orderedIds: string[]) {
  if (!orderedIds.length) return;
  await sql.query(
    `update categories c set sort_order = v.ord
     from (select unnest($1::text[]) as id, generate_subscripts($1::text[], 1) as ord) v
     where c.id = v.id`,
    [orderedIds],
  );
}

async function siblings(sql: QuerySql, parentId: string | null): Promise<Array<{ id: string; name: string }>> {
  return sql.query<{ id: string; name: string }>(
    "select id, name from categories where parent_id is not distinct from $1 order by sort_order, name",
    [parentId],
  );
}

async function nameOf(sql: QuerySql, id: string | null): Promise<string> {
  if (!id) return "Kök";
  const rows = await sql.query<{ name: string }>("select name from categories where id = $1", [id]);
  if (!rows[0]) throw new Error("Kategori bulunamadı.");
  return rows[0].name;
}

export type CategoryAttribute = {
  id: string;
  name: string;
  type: string;
  options: string[] | null;
  unit: string | null;
  required: boolean;
};

export const adminCategoryDetail = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ id: z.string().max(200) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string; name: string; slug: string; parent_id: string | null; icon: string | null; sort_order: number }>(
      "select id, name, slug, parent_id, icon, sort_order from categories where id = $1",
      [data.id],
    );
    const cat = rows[0];
    if (!cat) throw new Error("Kategori bulunamadı.");
    const [path, own, inherited, counts] = await Promise.all([
      pathOf(sql, data.id),
      sql.query<Record<string, unknown>>(
        `select a.id, a.name, a.type, a.options, a.unit, ca.required
         from category_attributes ca join attribute_defs a on a.id = ca.attribute_id
         where ca.category_id = $1 order by ca.required desc, a.name`,
        [data.id],
      ),
      sql.query<Record<string, unknown>>(
        `with recursive chain as (
           select id, parent_id, 0 as depth from categories where id = $1
           union all
           select c.id, c.parent_id, ch.depth + 1 from categories c join chain ch on ch.parent_id = c.id
         )
         select a.id, a.name, a.type, a.options, a.unit, ca.required, cat.id as source_id, cat.name as source_name, ch.depth
         from chain ch
         join category_attributes ca on ca.category_id = ch.id
         join attribute_defs a on a.id = ca.attribute_id
         join categories cat on cat.id = ch.id
         where ch.depth > 0
         order by ch.depth, a.name`,
        [data.id],
      ),
      sql.query<Record<string, unknown>>(
        `with recursive t as (
           select id from categories where id = $1
           union all
           select c.id from categories c join t on c.parent_id = t.id
         )
         select
           (select count(*) from t) - 1 as descendants,
           (select count(*) from categories where parent_id = $1) as children,
           (select count(*) from listings where category_id = $1) as direct_listings,
           (select count(*) from listings where category_id in (select id from t)) as subtree_listings,
           (select count(*) from listings where category_id in (select id from t)
              and status = 'ACTIVE' and (expires_at is null or expires_at > now())) as subtree_live`,
        [data.id],
      ),
    ]);
    const mapAttr = (r: Record<string, unknown>): CategoryAttribute => ({
      id: String(r.id),
      name: String(r.name),
      type: String(r.type),
      options: asJson<string[] | null>(r.options, null),
      unit: r.unit ? String(r.unit) : null,
      required: Boolean(r.required),
    });
    const c = counts[0] ?? {};
    return {
      category: { ...cat, sort_order: num(cat.sort_order) },
      path,
      ownAttributes: own.map(mapAttr),
      inheritedAttributes: inherited.map((r) => ({ ...mapAttr(r), source_id: String(r.source_id), source_name: String(r.source_name) })),
      counts: {
        descendants: num(c.descendants),
        children: num(c.children),
        direct_listings: num(c.direct_listings),
        subtree_listings: num(c.subtree_listings),
        subtree_live: num(c.subtree_live),
      },
    };
  });

export type AdminCategoryDetail = Awaited<ReturnType<typeof adminCategoryDetail>>;

async function uniqueId(sql: QuerySql, base: string, taken: Set<string>): Promise<string> {
  let id = base || "kategori";
  let n = 2;
  for (;;) {
    if (!taken.has(id)) {
      const exists = await sql.query<{ id: string }>("select id from categories where id = $1 or slug = $1", [id]);
      if (!exists[0]) return id;
    }
    id = `${base}-${n++}`;
  }
}

/** Adds one or many children (one name per line) at the end of `parentId`. */
export const adminCreateCategories = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      parentId: z.string().max(200).nullable(),
      names: z.array(z.string().trim().min(1).max(80)).min(1).max(500),
      icon: z.string().max(40).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const parentName = await nameOf(sql, data.parentId);
    const existing = await siblings(sql, data.parentId);
    const known = new Set(existing.map((s) => s.name.toLocaleLowerCase("tr")));
    const names = [...new Set(data.names.map((n) => n.trim()).filter(Boolean))].filter((n) => !known.has(n.toLocaleLowerCase("tr")));
    if (!names.length) throw new Error("Bu adlarla zaten alt kategori var.");
    const created = await sql.transaction(async (tx) => {
      const max = await tx.query<{ m: number }>(
        "select coalesce(max(sort_order), 0) as m from categories where parent_id is not distinct from $1",
        [data.parentId],
      );
      let order = num(max[0]?.m);
      const taken = new Set<string>();
      const out: Array<{ id: string; name: string }> = [];
      for (const name of names) {
        const id = await uniqueId(tx, slugify(data.parentId ? `${data.parentId}-${name}` : name), taken);
        taken.add(id);
        order += 1;
        await tx.query("insert into categories (id, name, slug, parent_id, icon, sort_order) values ($1,$2,$1,$3,$4,$5)", [
          id,
          name,
          data.parentId,
          data.parentId ? null : data.icon || null,
          order,
        ]);
        out.push({ id, name });
      }
      return out;
    });
    await audit(
      sql,
      context.adminId,
      "category.create",
      "category",
      created.length === 1 ? created[0].id : data.parentId,
      created.length === 1 ? `"${created[0].name}" eklendi (${parentName} altına)` : `${parentName} altına ${created.length} kategori eklendi`,
      { names: created.map((c) => c.name) },
    );
    return { ok: true as const, created, skipped: data.names.length - created.length };
  });

export const adminUpdateCategory = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      id: z.string().max(200),
      name: z.string().trim().min(1).max(80),
      slug: z.string().trim().min(1).max(100),
      icon: z.string().trim().max(40).nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ name: string; slug: string; icon: string | null }>("select name, slug, icon from categories where id = $1", [data.id]);
    const cur = rows[0];
    if (!cur) throw new Error("Kategori bulunamadı.");
    const slug = slugify(data.slug);
    if (!slug) throw new Error("Geçerli bir adres (slug) girin.");
    if (slug !== cur.slug) {
      const taken = await sql.query<{ id: string }>("select id from categories where slug = $1 and id <> $2", [slug, data.id]);
      if (taken[0]) throw new Error("Bu adres başka bir kategoride kullanılıyor.");
    }
    await sql.query("update categories set name = $2, slug = $3, icon = $4 where id = $1", [data.id, data.name, slug, data.icon || null]);
    const changes: string[] = [];
    if (cur.name !== data.name) changes.push(`ad "${cur.name}" → "${data.name}"`);
    if (cur.slug !== slug) changes.push(`adres ${cur.slug} → ${slug}`);
    if ((cur.icon ?? null) !== (data.icon || null)) changes.push("ikon");
    if (changes.length) {
      await audit(sql, context.adminId, "category.edit", "category", data.id, `${data.name}: ${changes.join(", ")}`);
    }
    return { ok: true as const, slug };
  });

/** Moves a category (with its subtree) under `parentId` at position `index` among its new siblings. */
export const adminMoveCategory = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      id: z.string().max(200),
      parentId: z.string().max(200).nullable(),
      index: z.number().int().min(0).max(100_000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ name: string; parent_id: string | null }>("select name, parent_id from categories where id = $1", [data.id]);
    const cur = rows[0];
    if (!cur) throw new Error("Kategori bulunamadı.");
    if (data.parentId) {
      const inside = await subtree(sql, data.id);
      if (inside.includes(data.parentId)) throw new Error("Bir kategori kendi alt dalına taşınamaz.");
    }
    const newParentName = await nameOf(sql, data.parentId);
    await sql.transaction(async (tx) => {
      const sibs = (await siblings(tx, data.parentId)).map((s) => s.id).filter((id) => id !== data.id);
      const at = Math.min(Math.max(data.index ?? sibs.length, 0), sibs.length);
      sibs.splice(at, 0, data.id);
      await tx.query("update categories set parent_id = $2 where id = $1", [data.id, data.parentId]);
      await renumber(tx, sibs);
    });
    if (cur.parent_id !== data.parentId) {
      const oldParentName = await nameOf(sql, cur.parent_id).catch(() => "?");
      await audit(sql, context.adminId, "category.move", "category", data.id, `"${cur.name}" ${oldParentName} → ${newParentName} altına taşındı`, {
        from: cur.parent_id,
        to: data.parentId,
      });
    } else {
      await audit(sql, context.adminId, "category.reorder", "category", data.id, `"${cur.name}" sırası değiştirildi`);
    }
    return { ok: true as const };
  });

/** Sets the full order of a parent's children. */
export const adminReorderCategories = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      parentId: z.string().max(200).nullable(),
      orderedIds: z.array(z.string().max(200)).max(5000).optional(),
      mode: z.enum(["manual", "alpha", "alpha_desc", "listings"]).default("manual"),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const parentName = await nameOf(sql, data.parentId);
    const sibs = await sql.query<{ id: string; name: string; n: number }>(
      `select c.id, c.name,
              (select count(*) from listings l where l.category_id = c.id) as n
       from categories c where c.parent_id is not distinct from $1 order by c.sort_order, c.name`,
      [data.parentId],
    );
    let ordered: string[];
    if (data.mode === "manual") {
      const ids = new Set(sibs.map((s) => s.id));
      const given = (data.orderedIds ?? []).filter((id) => ids.has(id));
      // Anything the client did not list keeps its relative order at the end.
      ordered = [...given, ...sibs.map((s) => s.id).filter((id) => !given.includes(id))];
    } else if (data.mode === "listings") {
      ordered = [...sibs].sort((a, b) => num(b.n) - num(a.n) || a.name.localeCompare(b.name, "tr")).map((s) => s.id);
    } else {
      const dir = data.mode === "alpha_desc" ? -1 : 1;
      ordered = [...sibs].sort((a, b) => dir * a.name.localeCompare(b.name, "tr", { numeric: true })).map((s) => s.id);
    }
    await renumber(sql, ordered);
    const label = { manual: "elle sıralandı", alpha: "A→Z sıralandı", alpha_desc: "Z→A sıralandı", listings: "ilan sayısına göre sıralandı" }[data.mode];
    await audit(sql, context.adminId, "category.reorder", "category", data.parentId, `${parentName} alt kategorileri ${label}`);
    return { ok: true as const };
  });

/**
 * Deletes a category and its whole subtree. Listings filed anywhere in that
 * subtree must be moved to `moveListingsTo` first (same transaction).
 */
export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ id: z.string().max(200), moveListingsTo: z.string().max(200).optional() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const name = await nameOf(sql, data.id);
    const ids = await subtree(sql, data.id);
    const used = await sql.query<{ n: number }>("select count(*) as n from listings where category_id = any($1::text[])", [ids]);
    const listingCount = num(used[0]?.n);
    let targetName: string | null = null;
    if (listingCount > 0) {
      if (!data.moveListingsTo) {
        throw new Error(`Bu dalda ${listingCount} ilan var. Silmeden önce ilanların taşınacağı kategoriyi seçin.`);
      }
      if (ids.includes(data.moveListingsTo)) throw new Error("İlanlar silinecek dalın içindeki bir kategoriye taşınamaz.");
      targetName = await nameOf(sql, data.moveListingsTo);
    }
    await sql.transaction(async (tx) => {
      if (listingCount > 0 && data.moveListingsTo) {
        await tx.query("update listings set category_id = $2, updated_at = now() where category_id = any($1::text[])", [ids, data.moveListingsTo]);
      }
      // Children and attribute links go with it (on delete cascade).
      await tx.query("delete from categories where id = $1", [data.id]);
    });
    await audit(
      sql,
      context.adminId,
      "category.delete",
      "category",
      data.id,
      `"${name}" silindi${ids.length > 1 ? ` (${ids.length - 1} alt kategoriyle)` : ""}${targetName ? `; ${listingCount} ilan "${targetName}" kategorisine taşındı` : ""}`,
      { removed: ids.length, movedListings: listingCount, to: data.moveListingsTo },
    );
    return { ok: true as const, removed: ids.length, movedListings: listingCount };
  });

/** Moves every listing of a subtree into another category (merge without deleting). */
export const adminMoveCategoryListings = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ fromId: z.string().max(200), toId: z.string().max(200), includeSubtree: z.boolean().default(true) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [fromName, toName] = [await nameOf(sql, data.fromId), await nameOf(sql, data.toId)];
    const ids = data.includeSubtree ? await subtree(sql, data.fromId) : [data.fromId];
    if (ids.includes(data.toId)) throw new Error("Hedef, kaynak dalın içinde olamaz.");
    const rows = await sql.query<{ id: string }>(
      "update listings set category_id = $2, updated_at = now() where category_id = any($1::text[]) returning id",
      [ids, data.toId],
    );
    await audit(sql, context.adminId, "category.move_listings", "category", data.fromId, `${rows.length} ilan "${fromName}" → "${toName}" taşındı`);
    return { ok: true as const, moved: rows.length };
  });

/** Replaces the attributes attached directly to a category. */
export const adminSetCategoryAttributes = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      categoryId: z.string().max(200),
      items: z.array(z.object({ attributeId: z.string().max(200), required: z.boolean() })).max(200),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const name = await nameOf(sql, data.categoryId);
    const unique = [...new Map(data.items.map((i) => [i.attributeId, i])).values()];
    if (unique.length) {
      const found = await sql.query<{ id: string }>("select id from attribute_defs where id = any($1::text[])", [unique.map((i) => i.attributeId)]);
      if (found.length !== unique.length) throw new Error("Bazı özellikler bulunamadı.");
    }
    await sql.transaction(async (tx) => {
      await tx.query("delete from category_attributes where category_id = $1", [data.categoryId]);
      for (const item of unique) {
        await tx.query("insert into category_attributes (category_id, attribute_id, required) values ($1,$2,$3)", [
          data.categoryId,
          item.attributeId,
          item.required,
        ]);
      }
    });
    await audit(sql, context.adminId, "category.attributes", "category", data.categoryId, `"${name}" özellikleri güncellendi (${unique.length} özellik)`);
    return { ok: true as const };
  });
