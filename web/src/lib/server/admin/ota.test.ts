import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { getSql, useTestDatabase } from "@/lib/db";
import { listAdminOtaUpdates } from "./ota";

const pg = new PGlite({ parsers: { 20: Number } });

before(async () => {
  const dir = join(process.cwd(), "migrations");
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(join(dir, file), "utf8"));
  }
  useTestDatabase(pg);
});

after(() => pg.close());

test("listAdminOtaUpdates works on empty tables and counts mixed-case update_id errors", async () => {
  const sql = await getSql();

  const empty = await listAdminOtaUpdates(sql);
  assert.deepEqual(empty.updates, []);
  assert.deepEqual(empty.recentErrors, []);

  const androidId = "11111111-1111-4111-8111-111111111111";
  const iosId = "22222222-2222-4222-8222-222222222222";
  const rollbackAndroidId = "33333333-3333-4333-8333-333333333333";
  const rollbackIosId = "44444444-4444-4444-8444-444444444444";

  const androidHash = "a".repeat(43);
  const iosHash = "b".repeat(43);
  const sharedAssetHash = "c".repeat(43);
  const androidBundle = Buffer.from("android-bundle");
  const iosBundle = Buffer.from("ios-bundle-data");
  const sharedAsset = Buffer.from("shared-png");

  await sql.query(
    `insert into ota_assets (hash, content_type, data) values ($1, 'application/javascript', $2), ($3, 'application/javascript', $4), ($5, 'image/png', $6)`,
    [androidHash, androidBundle, iosHash, iosBundle, sharedAssetHash, sharedAsset],
  );

  const sharedAssetsJson = JSON.stringify([{ hash: sharedAssetHash, key: "0".repeat(32), contentType: "image/png", fileExtension: ".png" }]);
  await sql.query(
    `insert into ota_updates (id, group_id, runtime_version, platform, channel, kind, launch_asset, assets, message, rollout, created_by, created_at)
     values
       ($1, 'ota_upd_1', '1.0.0', 'android', 'production', 'update', $3::jsonb, $4::jsonb, 'İlk güncelleme', 50, 'script', now() - interval '10 minutes'),
       ($2, 'ota_upd_1', '1.0.0', 'ios', 'production', 'update', $5::jsonb, $4::jsonb, 'İlk güncelleme', 50, 'script', now() - interval '10 minutes')`,
    [
      androidId,
      iosId,
      JSON.stringify({ hash: androidHash, key: "1".repeat(32), contentType: "application/javascript" }),
      sharedAssetsJson,
      JSON.stringify({ hash: iosHash, key: "2".repeat(32), contentType: "application/javascript" }),
    ],
  );

  await sql.query(
    `insert into ota_updates (id, group_id, runtime_version, platform, channel, kind, message, rollout, created_by, created_at)
     values
       ($1, 'ota_rb_1', '1.0.0', 'android', 'production', 'rollback', 'Mağaza sürümüne dönüş', 100, 'admin-1', now() - interval '1 minute'),
       ($2, 'ota_rb_1', '1.0.0', 'ios', 'production', 'rollback', 'Mağaza sürümüne dönüş', 100, 'admin-1', now() - interval '1 minute')`,
    [rollbackAndroidId, rollbackIosId],
  );

  await sql.query(
    `insert into client_errors (platform, app_version, update_id, device_id, fatal, message, screen)
     values
       ('android', '1.0.0', $1, 'dev-android-1', true, 'Android crash 1', '/ilan/1'),
       ('android', '1.0.0', $1, 'dev-android-1', false, 'Android error 2', '/ilan/2'),
       ('ios', '1.0.0', $2, 'dev-ios-1', true, 'iOS crash uppercase uuid', '/mesajlar'),
       ('ios', '1.0.0', null, 'dev-ios-2', false, 'Embedded error', '/ayarlar')`,
    [androidId, iosId.toUpperCase()],
  );

  const result = await listAdminOtaUpdates(sql);
  assert.equal(result.updates.length, 2);

  const [rollbackRow, updateRow] = result.updates;
  assert.equal(rollbackRow.groupId, "ota_rb_1");
  assert.equal(rollbackRow.kind, "rollback");
  assert.equal(rollbackRow.errors, 0);
  assert.equal(rollbackRow.errorDevices, 0);

  assert.equal(updateRow.groupId, "ota_upd_1");
  assert.equal(updateRow.kind, "update");
  assert.deepEqual(updateRow.platforms, ["android", "ios"]);
  assert.equal(updateRow.createdBy, "Yayın scripti");
  assert.equal(updateRow.bytes, androidBundle.byteLength + iosBundle.byteLength + sharedAsset.byteLength);
  assert.equal(updateRow.errors, 3);
  assert.equal(updateRow.errorDevices, 2);

  assert.equal(result.recentErrors.length, 4);
  assert.equal(result.recentErrors.some((e) => e.updateId === null && e.message === "Embedded error"), true);
});
