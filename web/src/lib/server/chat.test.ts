import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { getSql, useTestDatabase } from "@/lib/db";
import { getSellerResponseStats, loadOlderMessages } from "./chat";

const pg = new PGlite({ parsers: { 20: Number } });

before(async () => {
  const dir = join(process.cwd(), "migrations");
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(join(dir, file), "utf8"));
  }
  useTestDatabase(pg);
  const sql = await getSql();
  await sql.query("insert into categories (id,name,slug) values ('cat-chat','Sohbet Test','sohbet-test')");
  await sql.query(
    `insert into profiles (user_id,display_name) values
      ('seller-stat','Satıcı'),
      ('buyer-1','Alıcı 1'),
      ('buyer-2','Alıcı 2'),
      ('buyer-3','Alıcı 3'),
      ('buyer-4','Alıcı 4')`,
  );
  await sql.query(
    `insert into listings (id,slug,user_id,category_id,title,description,price)
     values ('lst-chat','sohbet-ilan','seller-stat','cat-chat','Test İlanı','Temiz test ilanı',500)`,
  );
});

after(() => pg.close());

test("getSellerResponseStats returns null under 3 conversations and computes rate/minutes at 3+", async () => {
  const sql = await getSql();
  await sql.query(
    `insert into conversations (id,listing_id,buyer_id,seller_id) values
      ('cv1','lst-chat','buyer-1','seller-stat'),
      ('cv2','lst-chat','buyer-2','seller-stat')`,
  );
  await sql.query(
    `insert into messages (id,conversation_id,sender_id,content,created_at) values
      ('m1','cv1','buyer-1','Merhaba', now() - interval '60 minutes'),
      ('m2','cv1','seller-stat','Selam', now() - interval '50 minutes'),
      ('m3','cv2','buyer-2','Duruyor mu?', now() - interval '30 minutes')`,
  );

  // Only 2 qualifying conversations -> null
  assert.equal(await getSellerResponseStats(sql, "seller-stat"), null);

  // Add 3rd qualifying conversation (replied in 20 minutes) + 4th seller-only (ignored)
  await sql.query(
    `insert into conversations (id,listing_id,buyer_id,seller_id) values
      ('cv3','lst-chat','buyer-3','seller-stat'),
      ('cv4','lst-chat','buyer-4','seller-stat')`,
  );
  await sql.query(
    `insert into messages (id,conversation_id,sender_id,content,created_at) values
      ('m4','cv3','buyer-3','Son fiyat?', now() - interval '40 minutes'),
      ('m5','cv3','seller-stat','450 TL', now() - interval '20 minutes'),
      ('m6','cv4','seller-stat','Merhaba', now() - interval '10 minutes')`,
  );

  const stats = await getSellerResponseStats(sql, "seller-stat");
  assert.ok(stats);
  // 2 replied out of 3 buyer-initiated conversations = 67%, avg reply = (10 + 20) / 2 = 15 min
  assert.equal(stats.responseRate, 67);
  assert.equal(stats.avgReplyMinutes, 15);
});

test("loadOlderMessages short-circuits on invalid before timestamp without hitting DB", async () => {
  const key = Symbol.for("tanstack-start:start-storage-context");
  const globals = globalThis as Record<symbol, AsyncLocalStorage<unknown> | undefined>;
  const storage = (globals[key] ??= new AsyncLocalStorage());
  await assert.doesNotReject(() =>
    storage.run({ startOptions: {} }, () =>
      loadOlderMessages({ data: { conversationId: "cv1", before: "not-a-timestamp" } }),
    ),
  );
  // A valid timestamp proceeds past the guard to conversation membership lookup.
  await assert.rejects(
    () =>
      storage.run({ startOptions: {} }, () =>
        loadOlderMessages({ data: { conversationId: "cv1", before: "2026-01-01T00:00:00.000Z" } }),
      ),
    TypeError,
  );
});

test("messages client_id unique index enforces idempotent message persistence", async () => {
  const sql = await getSql();
  const insertIdempotent = async (id: string, clientId: string) =>
    sql.query<{ id: string }>(
      `insert into messages (id, conversation_id, sender_id, content, kind, client_id)
       values ($1, 'cv1', 'buyer-1', 'Tekrar denemesi', 'text', $2)
       on conflict (conversation_id, sender_id, client_id) where client_id is not null do nothing
       returning id`,
      [id, clientId],
    );

  const first = await insertIdempotent("idem-1", "client-key-0001");
  const retry = await insertIdempotent("idem-2", "client-key-0001");
  const distinct = await insertIdempotent("idem-3", "client-key-0002");

  assert.equal(first.length, 1);
  assert.equal(retry.length, 0);
  assert.equal(distinct.length, 1);

  const saved = await sql.query<{ id: string }>(
    "select id from messages where conversation_id='cv1' and sender_id='buyer-1' and client_id is not null order by id",
  );
  assert.deepEqual(saved.map((r) => r.id), ["idem-1", "idem-3"]);
});
