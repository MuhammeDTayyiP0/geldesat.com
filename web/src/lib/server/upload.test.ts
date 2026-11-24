import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { inspectHeifMaxPixels, isHeif, processListingPhoto } from "./image-pipeline.server";
import { assertImageBytes, MAX_IMAGE_BYTES, sniffImageMime } from "./upload.server";

function box(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, out.length, false);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  return out;
}

function fullBox(type: string, body: Uint8Array): Uint8Array {
  const inner = new Uint8Array(4 + body.length);
  inner.set(body, 4);
  return box(type, inner);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function buildHeic(width: number, height: number): Uint8Array {
  const ftypBody = new Uint8Array(8);
  for (let i = 0; i < 4; i++) ftypBody[i] = "heic".charCodeAt(i);
  const ftyp = box("ftyp", ftypBody);

  const ispeBody = new Uint8Array(8);
  const ispeView = new DataView(ispeBody.buffer);
  ispeView.setUint32(0, width, false);
  ispeView.setUint32(4, height, false);
  const ispe = fullBox("ispe", ispeBody);
  const ipco = box("ipco", ispe);
  const iprp = box("iprp", ipco);
  const meta = fullBox("meta", iprp);
  return concatBytes(ftyp, meta);
}

test("sniffImageMime identifies JPEG, PNG, and WebP and rejects non-images", () => {
  assert.equal(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  const webp = new Uint8Array(12);
  webp.set([0x52, 0x49, 0x46, 0x46], 0);
  webp.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.equal(sniffImageMime(webp), "image/webp");
  assert.equal(sniffImageMime(new Uint8Array()), null);
  assert.equal(sniffImageMime(new TextEncoder().encode("<svg></svg>")), null);
});

test("assertImageBytes enforces non-empty, size limit, and magic bytes", () => {
  assert.throws(() => assertImageBytes(new Uint8Array(0)), /boş/);
  const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
  big.set([0xff, 0xd8, 0xff], 0);
  assert.throws(() => assertImageBytes(big), /en fazla/);
  assert.throws(() => assertImageBytes(new TextEncoder().encode("not-an-image")), /Geçersiz görsel/);
  assert.equal(assertImageBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xdb])), "image/jpeg");
});

test("inspectHeifMaxPixels parses ispe boxes and fails closed on bombs or missing boxes", () => {
  const valid = buildHeic(1200, 800);
  assert.equal(isHeif(valid), true);
  assert.deepEqual(inspectHeifMaxPixels(valid), {
    maxPixels: 960_000,
    maxEdge: 1200,
    foundIspe: true,
    truncated: false,
  });

  const missingIspe = box("ftyp", new TextEncoder().encode("heic\0\0\0\0"));
  assert.equal(inspectHeifMaxPixels(missingIspe).foundIspe, false);

  const pixelBomb = buildHeic(10_000, 10_000);
  assert.ok(inspectHeifMaxPixels(pixelBomb).maxPixels > 40_000_000);

  const edgeBomb = buildHeic(20_000, 100);
  assert.ok(inspectHeifMaxPixels(edgeBomb).maxEdge > 16_384);

  // Exceeding box count limit (> 512) sets truncated = true.
  const manyBoxes = concatBytes(...Array.from({ length: 520 }, () => box("free", new Uint8Array(0))));
  assert.equal(inspectHeifMaxPixels(manyBoxes).truncated, true);
});

test("processListingPhoto encodes valid PNG to WebP and isolates HEIC worker errors", async () => {
  const png = await sharp({
    create: { width: 320, height: 240, channels: 3, background: { r: 240, g: 120, b: 30 } },
  })
    .png()
    .toBuffer();

  const out = await processListingPhoto(png);
  assert.equal(sniffImageMime(out), "image/webp");
  const meta = await sharp(out).metadata();
  assert.equal(meta.width, 320);
  assert.equal(meta.height, 240);

  // Missing ispe fails closed before invoking worker.
  const noIspeHeic = box("ftyp", new TextEncoder().encode("heic\0\0\0\0"));
  await assert.rejects(() => processListingPhoto(noIspeHeic), /çözünürlüğü çok yüksek/);

  // Valid ispe with invalid HEIC bitstream runs inside the worker and rejects cleanly.
  const corruptHeic = buildHeic(320, 240);
  await assert.rejects(() => processListingPhoto(corruptHeic), /HEIC dosyası bozuk/);
});
