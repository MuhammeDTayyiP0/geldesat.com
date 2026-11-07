import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { getSql, useTestDatabase } from "@/lib/db";
import { searchListings } from "./catalog";

const CATEGORY = "test-arama";
const pg = new PGlite({ parsers: { 20: Number } });

before(async () => {
  const dir = join(process.cwd(), "migrations");
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(join(dir, file), "utf8"));
  }
  useTestDatabase(pg);
  const sql = await getSql();
  await sql.query("insert into categories (id,name,slug) values ($1,'Arama Testi','arama-testi')", [CATEGORY]);
  await sql.query("insert into profiles (user_id,display_name) values ('arama-satici','Satıcı')");
  const add = (id: string, title: string, price: number, extra: { status?: string; expires?: string } = {}) =>
    sql.query(
      `insert into listings (id,slug,user_id,category_id,title,description,price,status,expires_at)
       values ($1,$1,'arama-satici',$2,$3,'Temiz kullanılmış',$4,$5,$6)`,
      [id, CATEGORY, title, price, extra.status ?? "ACTIVE", extra.expires ?? null],
    );
  await add("a1", "Kırmızı bisiklet", 1000);
  await add("a2", "Mavi bisiklet %50 indirim", 3000);
  await add("a3", "Ahşap masa", 5000);
  await add("a4", "Süresi geçmiş bisiklet", 1000, { expires: "2020-01-01" });
  await add("a5", "Bekleyen bisiklet", 1000, { status: "PENDING" });
  await add("a6", "Satılmış bisiklet", 1000, { status: "SOLD" });
});

after(() => pg.close());

const ids = async (filters: Parameters<typeof searchListings>[0]) =>
  (await searchListings({ category: CATEGORY, ...filters })).listings.map((listing) => listing.id).sort();

test("only live listings are found", async () => {
  assert.deepEqual(await ids({}), ["a1", "a2", "a3"]);
});

test("text search matches the phrase, and does not read % as a wildcard", async () => {
  assert.deepEqual(await ids({ q: "bisiklet" }), ["a1", "a2"]);
  assert.deepEqual(await ids({ q: "%50" }), ["a2"]);
  assert.deepEqual(await ids({ q: "%" }), ["a2"]);
  assert.deepEqual(await ids({ q: "bisiklet kırmızı" }), []);
});

test("word search finds the words in any order", async () => {
  assert.deepEqual(await ids({ q: "bisiklet kırmızı", wordSearch: true }), ["a1"]);
});

test("price range and paging", async () => {
  assert.deepEqual(await ids({ minPrice: 2000, maxPrice: 4000 }), ["a2"]);
  const page = await searchListings({ category: CATEGORY, sort: "price_asc", limit: 2, page: 2 });
  assert.equal(page.total, 3);
  assert.equal(page.pages, 2);
  assert.deepEqual(page.listings.map((listing) => listing.id), ["a3"]);
});
