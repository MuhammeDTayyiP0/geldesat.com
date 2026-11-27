import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { useTestDatabase, type Sql } from "@/lib/db";
import { notifyMatchingSavedSearches } from "@/lib/server/saved-searches";
import { createMigratedTestDb } from "@/lib/server/test-db";

let sql: Sql;
let close: () => Promise<void>;

before(async () => {
  const ctx = await createMigratedTestDb();
  useTestDatabase(ctx.db);
  sql = ctx.sql;
  close = ctx.close;
  await sql.query("insert into profiles (user_id, display_name) values ('seller', 'Satıcı'), ('watcher-match', 'Takipçi 1'), ('watcher-miss', 'Takipçi 2')");
});

after(async () => {
  await close();
});

test("notifyMatchingSavedSearches evaluates JSONB filters (neighborhood, year, km, sellerType, withPhotos, attrs) and skips owner", async () => {
  await sql.query(
    `insert into saved_searches (id, user_id, name, category_slug, city, district, q, min_price, max_price, filters, notify) values
     ('ss-match', 'watcher-match', 'Eşleşen Arama', 'otomobil', 'İstanbul', 'Kadıköy', 'sedan', 500000, 1200000, $1::jsonb, true),
     ('ss-owner', 'seller', 'Kendi İlanım', 'otomobil', 'İstanbul', 'Kadıköy', null, null, null, '{}'::jsonb, true),
     ('ss-miss-year', 'watcher-miss', 'Yeni Model', 'otomobil', 'İstanbul', 'Kadıköy', null, null, null, '{"minYear":2024}'::jsonb, true),
     ('ss-miss-attr', 'watcher-miss', 'Otomatik', 'otomobil', 'İstanbul', 'Kadıköy', null, null, null, '{"attr_Vites":"Otomatik"}'::jsonb, true)`,
    [
      JSON.stringify({
        neighborhood: "Moda",
        minYear: 2018,
        maxYear: 2023,
        minKm: 10000,
        maxKm: 150000,
        withPhotos: true,
        sellerType: "individual",
        attr_Vites: "Manuel",
      }),
    ],
  );

  const count = await notifyMatchingSavedSearches(sql, {
    id: "lst-ss-1",
    title: "Temiz Aile Sedan Araç",
    slug: "temiz-aile-sedan-arac-1",
    userId: "seller",
    categorySlug: "otomobil",
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Moda",
    price: 850000,
    hasImages: true,
    isStore: false,
    attrs: { Yıl: 2021, Kilometre: 95000, Vites: "Manuel" },
  });

  assert.equal(count, 1);

  const notifs = await sql.query<{ user_id: string; link: string }>(
    "select user_id, link from notifications where type='listing'",
  );
  assert.deepEqual(notifs, [{ user_id: "watcher-match", link: "/ilan/temiz-aile-sedan-arac-1" }]);
});
