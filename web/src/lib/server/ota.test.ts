import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { buildManifest, multipartResponse, pickUpdate, sha256Base64Url, type OtaUpdateRow } from "./ota";

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

test("multipartResponse signs manifest parts in Expo Updates v1 SFV format", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const prevKey = process.env.OTA_CODE_SIGNING_PRIVATE_KEY;
  const prevKeyId = process.env.OTA_CODE_SIGNING_KEY_ID;
  try {
    process.env.OTA_CODE_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    delete process.env.OTA_CODE_SIGNING_KEY_ID;
    const res = multipartResponse([{ name: "manifest", body: { id: "u1", ok: true } }], 1, { sign: true });
    const text = await res.text();
    const [headersSection, bodySection] = text.split("\r\n\r\n");
    const sigLine = headersSection.split("\r\n").find((l) => l.startsWith("expo-signature: "));
    assert.ok(sigLine, "expected expo-signature header");
    const sigHeader = sigLine.slice("expo-signature: ".length);
    assert.match(sigHeader, /^sig="[A-Za-z0-9+/=]+", keyid="[^"]+", alg="rsa-v1_5-sha256"$/);
    const sigMatch = sigHeader.match(/^sig="([^"]+)"/);
    assert.ok(sigMatch);
    const partBody = bodySection.split("\r\n--")[0];
    assert.equal(
      verify("RSA-SHA256", Buffer.from(partBody, "utf8"), publicKey, Buffer.from(sigMatch[1], "base64")),
      true,
    );

    process.env.OTA_CODE_SIGNING_PRIVATE_KEY = "malformed-pem-key";
    assert.throws(() => multipartResponse([{ name: "manifest", body: { id: "u1" } }], 1, { sign: true }));
  } finally {
    if (prevKey === undefined) delete process.env.OTA_CODE_SIGNING_PRIVATE_KEY;
    else process.env.OTA_CODE_SIGNING_PRIVATE_KEY = prevKey;
    if (prevKeyId === undefined) delete process.env.OTA_CODE_SIGNING_KEY_ID;
    else process.env.OTA_CODE_SIGNING_KEY_ID = prevKeyId;
  }
});
