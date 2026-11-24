import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const dir = join(process.cwd(), "migrations");

async function schemaBefore(name: string) {
  const db = new PGlite();
  const files = (await readdir(dir)).filter((file) => /^\d+.*\.sql$/.test(file) && file < name).sort();
  for (const file of files) await db.exec(await readFile(join(dir, file), "utf8"));
  await db.query("insert into categories (id,name,slug) values ('cat','Kategori','kategori')");
  await db.query("insert into profiles (user_id,display_name) values ('buyer','Alıcı'),('seller','Satıcı')");
  await db.query("insert into listings (id,slug,user_id,category_id,title,description,price) values ('l1','ilan-1','seller','cat','Birinci','Açıklama',100),('l2','ilan-2','seller','cat','İkinci','Açıklama',100)");
  return db;
}

test("0032 keeps the newest rating per reviewer and seller, and allows no second one", async () => {
  const db = await schemaBefore("0032");
  try {
    await db.exec(`
      insert into reviews (id,seller_id,reviewer_id,listing_id,rating,created_at) values
        ('old','seller','buyer','l1',1,'2026-01-01'),
        ('new','seller','buyer','l2',5,'2026-02-01'),
        ('none','seller','buyer',null,3,'2025-01-01')`);
    await db.exec(await readFile(join(dir, "0032_review_report_integrity.sql"), "utf8"));
    const rows = await db.query<{ id: string }>("select id from reviews");
    assert.deepEqual(rows.rows.map((r) => r.id), ["new"]);
    await assert.rejects(db.query("insert into reviews (id,seller_id,reviewer_id,rating) values ('x','seller','buyer',4)"));
  } finally {
    await db.close();
  }
});

test("0032 keeps a report when its listing is deleted", async () => {
  const db = await schemaBefore("0032");
  try {
    await db.exec(await readFile(join(dir, "0032_review_report_integrity.sql"), "utf8"));
    await db.query("insert into reports (id,listing_id,reporter_id,reason) values ('r1','l1','buyer','Sahte ilan')");
    await db.query("delete from listings where id='l1'");
    const rows = await db.query<{ listing_id: string | null }>("select listing_id from reports where id='r1'");
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].listing_id, null);
  } finally {
    await db.close();
  }
});

test("0032 does not fail the deploy on an already duplicated paid order", async () => {
  const db = await schemaBefore("0032");
  try {
    await db.exec("insert into credit_ledger (id,user_id,amount,reason) values ('a','buyer',5,'order:1'),('b','buyer',5,'order:1')");
    await db.exec(await readFile(join(dir, "0032_review_report_integrity.sql"), "utf8"));
    const rows = await db.query("select id from credit_ledger");
    assert.equal(rows.rows.length, 2);
  } finally {
    await db.close();
  }
});

test("0035 search text ignores case and Turkish letters", async () => {
  const db = await schemaBefore("0036");
  try {
    await db.query("insert into listings (id,slug,user_id,category_id,title,description,price) values ('l3','ilan-3','seller','cat','KİRALIK Işıklı Daire','Çok güzel',100)");
    const rows = await db.query<{ search_text: string }>("select search_text from listings where id='l3'");
    assert.equal(rows.rows[0].search_text, "kiralik isikli daire cok guzel");
  } finally {
    await db.close();
  }
});

test("0043 applies cleanly even with legacy invalid rows and enforces constraints on new inserts", async () => {
  const db = await schemaBefore("0043");
  try {
    // Existing legacy rows violating constraints must not block migration 0043 (NOT VALID).
    await db.query("insert into listings (id,slug,user_id,category_id,title,description,price,status) values ('legacy','legacy-ilan','seller','cat','Eski ilan','Açıklama',0,'ACTIVE')");
    await db.query("insert into reviews (id,seller_id,reviewer_id,rating) values ('legacy-rev','seller','seller',5)");

    const sql0043 = await readFile(join(dir, "0043_indexes_constraints_and_features.sql"), "utf8");
    await db.exec(sql0043);
    // Re-running DO blocks must stay idempotent via duplicate_object guard.
    await db.exec(sql0043);

    await assert.rejects(
      db.query("insert into listings (id,slug,user_id,category_id,title,description,price) values ('bad-price','bad-price','seller','cat','Sıfır fiyat','Açıklama',0)"),
    );
    await assert.rejects(
      db.query("insert into listings (id,slug,user_id,category_id,title,description,price,status) values ('bad-status','bad-status','seller','cat','Geçersiz durum','Açıklama',100,'DRAFT')"),
    );
    await assert.rejects(
      db.query("insert into reviews (id,seller_id,reviewer_id,rating) values ('bad-self','seller','seller',5)"),
    );
    await assert.rejects(
      db.query("insert into reviews (id,seller_id,reviewer_id,rating) values ('bad-rate','seller','buyer',6)"),
    );

    await db.query(
      "insert into saved_searches (id,user_id,name,category_slug,city) values ('ss1','buyer','Arama','kategori','Adana')",
    );
    const saved = await db.query<{ id: string; notify: boolean }>("select id, notify from saved_searches where id='ss1'");
    assert.equal(saved.rows.length, 1);
    assert.equal(saved.rows[0].notify, true);
  } finally {
    await db.close();
  }
});
