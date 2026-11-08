import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { getSql, useTestDatabase } from "@/lib/db";
import { saveListingRecord } from "./listing-write";

const pg = new PGlite({ parsers: { 20: Number } });

before(async () => {
  const dir = join(process.cwd(), "migrations");
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(join(dir, file), "utf8"));
  }
  useTestDatabase(pg);
  const sql = await getSql();
  await sql.query("insert into categories (id,name,slug) values ('test-yaz','Yazma Testi','yazma-testi')");
  await sql.query("insert into profiles (user_id,display_name,phone) values ('yazan','Yazan','05551112233')");
});

after(() => pg.close());

const input = (clientKey?: string) => ({
  categoryId: "test-yaz",
  title: "Temiz bisiklet",
  description: "Az kullanılmış, sorunsuz bisiklet.",
  price: 1500,
  city: "İzmir",
  district: "Bornova",
  images: [],
  attrs: {},
  clientKey,
});

test("the same client key twice makes one listing", async () => {
  const first = await saveListingRecord("yazan", input("anahtar-12345678"));
  const again = await saveListingRecord("yazan", input("anahtar-12345678"));
  assert.equal(again.id, first.id);
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>("select count(*)::int as n from listings where user_id='yazan'");
  assert.equal(rows[0].n, 1);
});

test("without a key, or with another key, each publish is a new listing", async () => {
  const a = await saveListingRecord("yazan", input());
  const b = await saveListingRecord("yazan", input("baska-anahtar-1234"));
  assert.notEqual(a.id, b.id);
});
