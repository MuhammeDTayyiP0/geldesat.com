import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { useTestDatabase, type Sql } from "@/lib/db";
import { purgeUserData } from "@/lib/server/account-purge";
import { bulkImportListingsRecord } from "@/lib/server/account";
import { clearCategoryCache } from "@/lib/server/category-cache";
import { createMigratedTestDb } from "@/lib/server/test-db";

let sql: Sql;
let close: () => Promise<void>;

before(async () => {
  const ctx = await createMigratedTestDb();
  useTestDatabase(ctx.db);
  clearCategoryCache();
  sql = ctx.sql;
  close = ctx.close;
  await sql.query("insert into profiles (user_id, display_name, phone) values ('u-purge', 'Silinecek Üye', '05320000001'), ('u-other', 'Diğer Üye', '05320000002'), ('u-store', 'Mağaza Üye', '05320000003')");
  await sql.query("insert into stores (id, user_id, name, slug) values ('st-1', 'u-store', 'Test Mağaza', 'test-magaza')");
});

after(async () => {
  await close();
});

test("purgeUserData deletes user listings/favorites/follows and preserves conversations for the other party", async () => {
  await sql.query("insert into categories (id, name, slug) values ('cat-life', 'Elektronik', 'elektronik-test') on conflict do nothing");
  await sql.query("insert into listings (id, slug, user_id, category_id, title, description, price, status) values ('lst-p1', 'lst-p1', 'u-purge', 'cat-life', 'Telefon', 'Açıklama metni', 5000, 'ACTIVE')");
  await sql.query("insert into conversations (id, listing_id, buyer_id, seller_id) values ('conv-p1', 'lst-p1', 'u-other', 'u-purge')");
  await sql.query("insert into seller_follows (follower_id, seller_id) values ('u-other', 'u-purge')");

  await purgeUserData(sql, "u-purge", { deleteListings: true, includeAuth: false });

  const profile = await sql.query("select 1 from profiles where user_id='u-purge'");
  assert.equal(profile.length, 0);
  const listings = await sql.query("select 1 from listings where id='lst-p1'");
  assert.equal(listings.length, 0);
  const follows = await sql.query("select 1 from seller_follows where seller_id='u-purge'");
  assert.equal(follows.length, 0);
  const conv = await sql.query<{ seller_hidden_at: unknown }>("select seller_hidden_at from conversations where id='conv-p1'");
  assert.equal(conv.length, 1);
  assert.ok(conv[0].seller_hidden_at != null);
});

test("bulkImportListingsRecord rejects invalid Turkish city/district and stores null lat/lng", async () => {
  const res = await bulkImportListingsRecord(sql, "u-store", [
    {
      title: "Geçersiz Şehirli İlan",
      description: "Bu ilanın şehri geçersiz olduğu için eklenmemeli.",
      price: 1500,
      categorySlug: "elektronik-test",
      city: "Atlantis",
      district: "Merkez",
    },
    {
      title: "Geçerli Mağaza İlanı",
      description: "Bu ilan geçerli il ve ilçe ile eklenmelidir.",
      price: 2500,
      categorySlug: "elektronik-test",
      city: "İstanbul",
      district: "Kadıköy",
    },
  ]);

  assert.equal(res.imported, 1);
  assert.equal(res.errors.length, 1);
  const inserted = await sql.query<{ lat: number | null; lng: number | null; city: string }>(
    "select lat, lng, city from listings where user_id='u-store'",
  );
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].city, "İstanbul");
  assert.equal(inserted[0].lat, null);
  assert.equal(inserted[0].lng, null);
});
