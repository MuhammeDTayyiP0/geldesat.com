import assert from "node:assert/strict";
import test from "node:test";
import { buildManifest, pickUpdate, sha256Base64Url, type OtaUpdateRow } from "./ota";

const asset = { hash: "a".repeat(43), key: "0".repeat(32), contentType: "application/javascript" };
const row = (group: string, minutesAgo: number, patch: Partial<OtaUpdateRow> = {}): OtaUpdateRow => ({
  id: `00000000-0000-4000-8000-${String(minutesAgo).padStart(12, "0")}`,
  group_id: group,
  runtime_version: "1.0.0",
  platform: "android",
  channel: "production",
  kind: "update",
  launch_asset: asset,
  assets: [{ hash: "b".repeat(43), key: "1".repeat(32), contentType: "image/png", fileExtension: ".png" }],
  expo_client: { version: "1.0.0" },
  message: group,
  rollout: 100,
  critical: false,
  created_at: new Date(Date.now() - minutesAgo * 60_000),
  ...patch,
});
const devices = Array.from({ length: 2000 }, (_, i) => `device-${i}`);

test("the newest full update wins", () => {
  assert.equal(pickUpdate([row("new", 1), row("old", 10)], "d")?.group_id, "new");
  assert.equal(pickUpdate([], "d"), null);
});

test("a partial rollout reaches its share; the rest stay on the previous update", () => {
  const rows = [row("canary", 1, { rollout: 20 }), row("stable", 10)];
  const onCanary = devices.filter((d) => pickUpdate(rows, d)?.group_id === "canary").length;
  assert.ok(onCanary > 300 && onCanary < 500, `${onCanary}`);
  assert.equal(pickUpdate(rows, null)?.group_id, "stable");
});

test("a paused update goes to nobody", () => {
  for (const d of devices.slice(0, 100)) assert.equal(pickUpdate([row("paused", 1, { rollout: 0 }), row("stable", 10)], d)?.group_id, "stable");
});

test("the manifest follows the Expo Updates protocol shape", () => {
  const m = buildManifest(row("g", 1), "https://www.geldesat.com");
  assert.equal(m.launchAsset.url, `https://www.geldesat.com/api/ota/assets/${"a".repeat(43)}`);
  assert.equal("fileExtension" in m.launchAsset, false);
  assert.equal(m.assets[0].fileExtension, ".png");
  assert.equal(m.runtimeVersion, "1.0.0");
  assert.match(m.createdAt, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(m.extra.expoClient, { version: "1.0.0" });
});

test("hashes are base64url SHA-256", () => {
  assert.equal(sha256Base64Url(new TextEncoder().encode("abc")), "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
});
