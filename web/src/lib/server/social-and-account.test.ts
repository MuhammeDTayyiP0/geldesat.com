import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { getSql, useTestDatabase } from "@/lib/db";
import {
  bulkImportListingsRecord,
  myStoreApplicationRecord,
  submitStoreApplicationRecord,
} from "./account";
import { fetchListingsByIds, fetchMapListingsInBounds } from "./catalog";
import {
  followSellerRecord,
  getFollowStatusRecord,
  myFollowedSellersRecord,
  notifySellerFollowers,
  unfollowSellerRecord,
} from "./follows";

const pg = new PGlite({ parsers: { 20: Number } });

before(async () => {
  const dir = join(process.cwd(), "migrations");
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(join(dir, file), "utf8"));
  }
  useTestDatabase(pg);
  const sql = await getSql();
  await sql.query("insert into categories (id,name,slug) values ('cat-social','Sosyal Test','sosyal-test')");
  await sql.query(
    `insert into profiles (user_id,display_name,phone) values
      ('satici-1','Satıcı Bir','05551110001'),
      ('takipci-1','Takipçi Bir','05551110002'),
      ('basvuran-1','Başvuran Bir','05551110003'),
      ('magazali-1','Mağazalı Bir','05551110004')`,
  );
  await sql.query(
    "insert into stores (id,user_id,name,slug,city) values ('st-1','magazali-1','Deneme Mağaza','deneme-magaza','İstanbul')",
  );
});

after(() => pg.close());

test("followSeller, unfollowSeller, getFollowStatus, and notifySellerFollowers work end-to-end", async () => {
  const sql = await getSql();

  await assert.rejects(() => followSellerRecord(sql, "satici-1", "satici-1"), /Kendinizi takip/);

  assert.deepEqual(await getFollowStatusRecord(sql, "takipci-1", "satici-1"), {
    following: false,
    followers: 0,
  });

  const followed = await followSellerRecord(sql, "takipci-1", "satici-1");
  assert.deepEqual(followed, { following: true, followers: 1 });

  // Duplicate follow stays idempotent
  assert.deepEqual(await followSellerRecord(sql, "takipci-1", "satici-1"), {
    following: true,
    followers: 1,
  });

  assert.deepEqual(await getFollowStatusRecord(sql, "takipci-1", "satici-1"), {
    following: true,
    followers: 1,
  });
  assert.deepEqual(await getFollowStatusRecord(sql, null, "satici-1"), {
    following: false,
    followers: 1,
  });

  const list = await myFollowedSellersRecord(sql, "takipci-1");
  assert.equal(list.length, 1);
  assert.equal(list[0].id, "satici-1");

  const notified = await notifySellerFollowers(sql, {
    id: "lst-new",
    title: "Yeni Kamera",
    slug: "yeni-kamera-1000001",
    userId: "satici-1",
    sellerName: "Satıcı Bir",
  });
  assert.equal(notified, 1);
  const notifs = await sql.query<{ title: string; body: string }>(
    "select title, body from notifications where user_id='takipci-1'",
  );
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].body, "Yeni Kamera");

  const unfollowed = await unfollowSellerRecord(sql, "takipci-1", "satici-1");
  assert.deepEqual(unfollowed, { following: false, followers: 0 });
});

test("submitStoreApplication creates pending application and enforces validation, cooldown, and duplicates", async () => {
  const sql = await getSql();
  assert.equal(await myStoreApplicationRecord(sql, "basvuran-1"), null);

  const validApp = {
    name: "Anadolu Emlak",
    businessType: "COMPANY" as const,
    sector: "Emlak Ofisi",
    taxOffice: "Çankaya Vergi Dairesi",
    taxNo: "1234567890",
    city: "Ankara",
    phone: "05552223344",
    address: "Kızılay Mah. Atatürk Bulvarı No:12 Çankaya/Ankara",
    notes: "Kurumsal mağaza talebi",
  };

  await assert.rejects(
    () => submitStoreApplicationRecord(sql, "basvuran-1", { ...validApp, taxNo: "12345" }),
    /10 haneli Vergi Kimlik Numarası/,
  );

  const created = await submitStoreApplicationRecord(sql, "basvuran-1", validApp);
  assert.equal(created.status, "PENDING");
  assert.equal(created.name, "Anadolu Emlak");
  assert.equal(created.business_type, "COMPANY");
  assert.equal(created.sector, "Emlak Ofisi");

  const fetched = await myStoreApplicationRecord(sql, "basvuran-1");
  assert.equal(fetched?.id, created.id);

  await assert.rejects(
    () => submitStoreApplicationRecord(sql, "basvuran-1", { ...validApp, name: "İkinci Başvuru" }),
    /inceleme bekleyen/,
  );

  await assert.rejects(
    () => submitStoreApplicationRecord(sql, "magazali-1", { ...validApp, name: "Yeni Mağaza" }),
    /Zaten bir kurumsal mağazanız var/,
  );

  // Reddedilen başvuru için 7 gün bekleme süresi uygulanmalı; 8 gün önce reddedilmişse tekrar başvurabilmeli
  await sql.query(
    `insert into store_applications (id, user_id, name, status, reviewed_at)
     values ('sapp-rej-recent', 'basvuran-2', 'Red Mağaza', 'REJECTED', now() - interval '2 days')`,
  );
  await assert.rejects(
    () => submitStoreApplicationRecord(sql, "basvuran-2", validApp),
    /gün sonra yeniden başvurabilirsiniz/,
  );
  await sql.query("update store_applications set reviewed_at = now() - interval '8 days' where id='sapp-rej-recent'");
  const retried = await submitStoreApplicationRecord(sql, "basvuran-2", { ...validApp, businessType: "SOLE", taxNo: "12345678901" });
  assert.equal(retried.status, "PENDING");
});

test("getListingsByIds and mapListingsInBounds return matching live listings", async () => {
  const sql = await getSql();
  await sql.query(
    `insert into listings (id,slug,user_id,category_id,title,description,price,status,city,lat,lng) values
      ('cmp-1','ilan-cmp-1','satici-1','cat-social','İstanbul Laptop','Temiz dizüstü',15000,'ACTIVE','İstanbul',41.01,28.97),
      ('cmp-2','ilan-cmp-2','satici-1','cat-social','Ankara Masa','Masif masa',5000,'ACTIVE','Ankara',null,null),
      ('cmp-3','ilan-cmp-3','satici-1','cat-social','Taslak Ürün','Yayında değil',9000,'PENDING','İstanbul',41.02,28.98)`,
  );

  const compared = await fetchListingsByIds(sql, ["cmp-2", "cmp-3", "cmp-1"]);
  assert.deepEqual(
    compared.map((l) => l.id),
    ["cmp-2", "cmp-1"],
  );

  // Bounding box around Istanbul only
  const istanbulMap = await fetchMapListingsInBounds(sql, {
    north: 41.3,
    south: 40.8,
    east: 29.4,
    west: 28.5,
  });
  assert.deepEqual(
    istanbulMap.map((l) => l.id),
    ["cmp-1"],
  );

  // Bounding box around Ankara catches cmp-2 via CITY_COORDS fallback
  const ankaraMap = await fetchMapListingsInBounds(sql, {
    north: 40.3,
    south: 39.5,
    east: 33.3,
    west: 32.4,
  });
  assert.deepEqual(
    ankaraMap.map((l) => l.id),
    ["cmp-2"],
  );
  assert.ok(ankaraMap[0].lat != null && ankaraMap[0].lng != null);
});

test("bulkImportListings requires a store, validates rows, and inserts valid rows in a transaction", async () => {
  const sql = await getSql();

  await assert.rejects(
    () =>
      bulkImportListingsRecord(sql, "basvuran-1", [
        {
          title: "Mağazasız İlan",
          description: "Bu ilan mağaza olmadan yüklenemez.",
          price: 1000,
          categorySlug: "sosyal-test",
          city: "İstanbul",
          district: "Kadıköy",
        },
      ]),
    /mağazanız olmalıdır/,
  );

  await sql.query(
    `insert into app_config (key, value) values ('moderation', '{"mode":"all"}'::jsonb)
     on conflict (key) do update set value = excluded.value`,
  );

  const res = await bulkImportListingsRecord(sql, "magazali-1", [
    {
      title: "Geçerli Toplu İlan 1",
      description: "Sorunsuz çalışan ürün, kutulu.",
      price: 2500,
      currency: "USD",
      categorySlug: "sosyal-test",
      city: "İstanbul",
      district: "Kadıköy",
      neighborhood: "Moda",
    },
    {
      title: "Kısa",
      description: "Başlık çok kısa olduğu için hata vermeli.",
      price: 500,
      categorySlug: "sosyal-test",
      city: "İstanbul",
      district: "Kadıköy",
    },
    {
      title: "Bilinmeyen Kategori İlanı",
      description: "Kategori slug hatalı olduğu için hata vermeli.",
      price: 500,
      categorySlug: "olmayan-kategori",
      city: "İstanbul",
      district: "Kadıköy",
    },
  ]);

  assert.equal(res.imported, 1);
  assert.equal(res.errors.length, 2);
  assert.equal(res.errors[0].index, 1);
  assert.equal(res.errors[1].index, 2);

  const rows = await sql.query<{ status: string; currency: string; store_id: string }>(
    "select status, currency, store_id from listings where user_id='magazali-1'",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "PENDING");
  assert.equal(rows[0].currency, "USD");
  assert.equal(rows[0].store_id, "st-1");
});
