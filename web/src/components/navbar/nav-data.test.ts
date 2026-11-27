import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createMigratedTestDb } from "@/lib/server/test-db";

test("every category in the menu exists in the migrated categories table", async () => {
  const nav = await readFile(join(process.cwd(), "src/components/navbar/nav-data.ts"), "utf8");
  const slugs = [...new Set([...nav.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]).filter((s) => s !== "string"))];
  assert.ok(slugs.length > 50);

  const { sql, close } = await createMigratedTestDb();
  try {
    const rows = await sql.query<{ slug: string }>("select slug from categories where slug = any($1::text[])", [slugs]);
    const existing = new Set(rows.map((r) => r.slug));
    const missing = slugs.filter((slug) => !existing.has(slug));
    assert.deepEqual(missing, []);
  } finally {
    await close();
  }
});
