import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { asJson, num, slugify } from "@/lib/utils";
import { adminMiddleware, audit } from "./common";

export const ATTRIBUTE_TYPES = ["SELECT", "MULTI", "NUMBER", "BOOLEAN", "TEXT"] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export type AdminAttribute = {
  id: string;
  name: string;
  type: string;
  options: string[] | null;
  unit: string | null;
  categories: number;
  required_in: number;
  sample: string[];
};

/** The attribute library with how many categories use each one. */
export const adminListAttributes = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select a.id, a.name, a.type, a.options, a.unit,
              count(ca.category_id) as categories,
              count(ca.category_id) filter (where ca.required) as required_in,
              coalesce((array_agg(c.name order by c.name) filter (where c.name is not null))[1:3], '{}') as sample
       from attribute_defs a
       left join category_attributes ca on ca.attribute_id = a.id
       left join categories c on c.id = ca.category_id
       group by a.id
       order by a.name`,
    );
    return rows.map(
      (r): AdminAttribute => ({
        id: String(r.id),
        name: String(r.name),
        type: String(r.type),
        options: asJson<string[] | null>(r.options, null),
        unit: r.unit ? String(r.unit) : null,
        categories: num(r.categories),
        required_in: num(r.required_in),
        sample: Array.isArray(r.sample) ? (r.sample as string[]) : [],
      }),
    );
  });

/** Categories an attribute is attached to, with their paths, and how many listings carry a value. */
export const adminAttributeUsage = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ id: z.string().max(200) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const def = await sql.query<{ name: string }>("select name from attribute_defs where id = $1", [data.id]);
    if (!def[0]) throw new Error("Özellik bulunamadı.");
    const [links, cats, used] = await Promise.all([
      sql.query<{ category_id: string; required: boolean }>(
        "select category_id, required from category_attributes where attribute_id = $1",
        [data.id],
      ),
      sql.query<{ id: string; name: string; parent_id: string | null }>("select id, name, parent_id from categories"),
      sql.query<{ n: number }>("select count(*) as n from listings where attrs ? $1", [def[0].name]),
    ]);
    const byId = new Map(cats.map((c) => [c.id, c]));
    const pathOf = (id: string) => {
      const names: string[] = [];
      for (let cur = byId.get(id); cur; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) names.unshift(cur.name);
      return names.join(" › ");
    };
    return {
      links: links
        .map((l) => ({ category_id: l.category_id, required: Boolean(l.required), path: pathOf(l.category_id) || l.category_id }))
        .sort((a, b) => a.path.localeCompare(b.path, "tr")),
      listingsWithValue: num(used[0]?.n),
    };
  });

const SaveInput = z.object({
  id: z.string().max(200).optional(),
  name: z.string().trim().min(1).max(60),
  type: z.enum(ATTRIBUTE_TYPES),
  options: z.array(z.string().trim().min(1).max(80)).max(500).optional(),
  unit: z.string().trim().max(20).optional(),
  /** On rename, move existing listing values to the new name. */
  migrateValues: z.boolean().default(true),
});

export const adminSaveAttribute = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(SaveInput)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const needsOptions = data.type === "SELECT" || data.type === "MULTI";
    const options = needsOptions ? [...new Set((data.options ?? []).map((o) => o.trim()).filter(Boolean))] : data.type === "BOOLEAN" ? ["Evet", "Hayır"] : null;
    if (needsOptions && (!options || options.length < 2)) throw new Error("Seçenekli özellik için en az 2 seçenek girin.");
    const unit = data.type === "NUMBER" ? data.unit || null : null;

    if (!data.id) {
      const base = slugify(data.name).replace(/-/g, "_") || "ozellik";
      let id = base;
      for (let n = 2; (await sql.query("select 1 from attribute_defs where id = $1", [id])).length; n += 1) id = `${base}_${n}`;
      await sql.query("insert into attribute_defs (id, name, type, options, unit) values ($1,$2,$3,$4::jsonb,$5)", [
        id,
        data.name,
        data.type,
        options ? JSON.stringify(options) : null,
        unit,
      ]);
      await audit(sql, context.adminId, "attribute.create", "attribute", id, `Özellik "${data.name}" (${data.type}) oluşturuldu`);
      return { ok: true as const, id, migrated: 0 };
    }

    const cur = (await sql.query<{ name: string; type: string }>("select name, type from attribute_defs where id = $1", [data.id]))[0];
    if (!cur) throw new Error("Özellik bulunamadı.");
    let migrated = 0;
    await sql.transaction(async (tx) => {
      await tx.query("update attribute_defs set name = $2, type = $3, options = $4::jsonb, unit = $5 where id = $1", [
        data.id,
        data.name,
        data.type,
        options ? JSON.stringify(options) : null,
        unit,
      ]);
      // Listing values are keyed by the attribute's name; carry them over to the
      // new name, but only in categories that actually use this attribute.
      if (data.migrateValues && cur.name !== data.name) {
        const rows = await tx.query<{ id: string }>(
          `with recursive scope as (
             select category_id as id from category_attributes where attribute_id = $1
             union
             select c.id from categories c join scope s on c.parent_id = s.id
           )
           update listings set attrs = (attrs - $2::text) || jsonb_build_object($3::text, attrs -> $2::text)
           where attrs ? $2::text and not attrs ? $3::text and category_id in (select id from scope)
           returning id`,
          [data.id, cur.name, data.name],
        );
        migrated = rows.length;
      }
    });
    await audit(
      sql,
      context.adminId,
      "attribute.edit",
      "attribute",
      data.id,
      cur.name !== data.name ? `Özellik "${cur.name}" → "${data.name}"${migrated ? ` (${migrated} ilan değeri taşındı)` : ""}` : `Özellik "${data.name}" düzenlendi`,
    );
    return { ok: true as const, id: data.id, migrated };
  });

export const adminDeleteAttribute = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ id: z.string().max(200) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cur = (await sql.query<{ name: string }>("select name from attribute_defs where id = $1", [data.id]))[0];
    if (!cur) throw new Error("Özellik bulunamadı.");
    const links = await sql.query<{ n: number }>("select count(*) as n from category_attributes where attribute_id = $1", [data.id]);
    // Links go with it (on delete cascade); listing values stay in the listing data.
    await sql.query("delete from attribute_defs where id = $1", [data.id]);
    await audit(sql, context.adminId, "attribute.delete", "attribute", data.id, `Özellik "${cur.name}" silindi (${num(links[0]?.n)} kategoriden kaldırıldı)`);
    return { ok: true as const };
  });
