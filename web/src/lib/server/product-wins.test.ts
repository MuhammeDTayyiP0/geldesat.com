import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { useTestDatabase, type Sql } from "@/lib/db";
import { EDIT_WINDOW_MS } from "@/lib/chat-shared";
import { searchListings } from "@/lib/server/catalog";
import { createMigratedTestDb } from "@/lib/server/test-db";

let sql: Sql;
let close: () => Promise<void>;

before(async () => {
  const ctx = await createMigratedTestDb();
  useTestDatabase(ctx.db);
  sql = ctx.sql;
  close = ctx.close;
  await sql.query("insert into profiles (user_id, display_name) values ('pw-seller', 'Satıcı'), ('pw-buyer', 'Alıcı')");
  await sql.query("insert into categories (id, name, slug) values ('pw-cat', 'Test Kategori', 'pw-test-kat')");
});

after(async () => {
  await close();
});

test("searchListings supports Haversine distance sort, maxDistanceKm radius, and previous_price", async () => {
  // Kadıköy center: 40.9903, 29.0297
  await sql.query(
    `insert into listings (id, slug, user_id, category_id, title, description, price, currency, status, city, district, lat, lng) values
     ('pw-near', 'pw-near', 'pw-seller', 'pw-cat', 'Yakın İlan', 'Açıklama metni', 900, 'TRY', 'ACTIVE', 'İstanbul', 'Kadıköy', 40.9920, 29.0310),
     ('pw-mid', 'pw-mid', 'pw-seller', 'pw-cat', 'Orta Mesafe', 'Açıklama metni', 1000, 'TRY', 'ACTIVE', 'İstanbul', 'Beşiktaş', 41.0422, 29.0067),
     ('pw-far', 'pw-far', 'pw-seller', 'pw-cat', 'Uzak İlan', 'Açıklama metni', 1100, 'TRY', 'ACTIVE', 'Ankara', 'Çankaya', 39.9208, 32.8541)`,
  );
  // Record a higher historical price for pw-near
  await sql.query("insert into price_history (listing_id, price) values ('pw-near', 1200)");

  const res = await searchListings({
    category: "pw-test-kat",
    nearLat: 40.9903,
    nearLng: 29.0297,
    maxDistanceKm: 25,
    sort: "distance",
    limit: 10,
    page: 1,
  });

  assert.deepEqual(
    res.listings.map((l) => l.id),
    ["pw-near", "pw-mid"],
  );
  assert.ok(res.listings[0].distance_km != null && res.listings[0].distance_km < 1);
  assert.ok(res.listings[1].distance_km != null && res.listings[1].distance_km > 3);
  assert.equal(res.listings[0].previous_price, 1200);
  assert.equal(res.listings[1].previous_price, null);
});

test("percentile_cont market price stats and chat pin/mute/edit columns work in migrated schema", async () => {
  const stats = (
    await sql.query<{ count: number; p25: number; median: number; p75: number }>(
      `select count(*)::int as count,
              percentile_cont(0.25) within group (order by price)::float8 as p25,
              percentile_cont(0.5) within group (order by price)::float8 as median,
              percentile_cont(0.75) within group (order by price)::float8 as p75
       from listings where category_id='pw-cat' and status='ACTIVE'`,
    )
  )[0];

  assert.equal(stats.count, 3);
  assert.equal(stats.median, 1000);
  assert.ok(stats.p25 <= stats.median && stats.median <= stats.p75);

  await sql.query(
    `insert into conversations (id, listing_id, buyer_id, seller_id, buyer_pinned_at, buyer_muted_until) values
     ('pw-conv-1', 'pw-near', 'pw-buyer', 'pw-seller', now(), now() + interval '100 years'),
     ('pw-conv-2', 'pw-mid', 'pw-buyer', 'pw-seller', null, null)`,
  );
  const ordered = await sql.query<{ id: string; muted: boolean }>(
    `select id, (buyer_muted_until is not null and buyer_muted_until > now()) as muted
     from conversations where buyer_id='pw-buyer'
     order by buyer_pinned_at desc nulls last, updated_at desc`,
  );
  assert.deepEqual(ordered, [
    { id: "pw-conv-1", muted: true },
    { id: "pw-conv-2", muted: false },
  ]);

  await sql.query(
    "insert into messages (id, conversation_id, sender_id, content, kind, edited_at) values ('pw-msg-1', 'pw-conv-1', 'pw-buyer', 'Düzenlendi', 'text', now())",
  );
  const msg = (await sql.query<{ edited_at: unknown }>("select edited_at from messages where id='pw-msg-1'"))[0];
  assert.ok(msg.edited_at != null);
  assert.equal(EDIT_WINDOW_MS, 15 * 60_000);
});
