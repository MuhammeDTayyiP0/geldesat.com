import sharp from "sharp";

/**
 * Listing photo pipeline, done on the server the way large marketplaces do it:
 * keep the photo's own aspect ratio (no padding bars), honour EXIF rotation,
 * strip metadata (GPS, camera serials), cap the long edge, add a watermark and
 * store one WebP master. Smaller sizes are derived on request (see `resizeVariant`).
 */

/** Sharp enough for a full-screen view on large and high-DPI monitors. */
const MASTER_LONG_EDGE = 2048;
const MIN_SHORT_EDGE = 240;
/** Stored masters must fit the 2 MB column check in mobile_listing_images. */
const MAX_STORED_BYTES = 2 * 1024 * 1024;
/** Widths the site asks for in cards, thumbnails and the gallery. */
export const VARIANT_WIDTHS = [240, 480, 800, 1200] as const;

/** GeldeSat logo strokes (64×64 viewBox) at the given stroke width. */
const markPaths = (width: number) => `
  <path d="M36 12 H 24 A 12 12 0 0 0 12 24 V 28 A 4 4 0 0 0 16 32 H 48 A 4 4 0 0 1 52 36 V 40 A 12 12 0 0 1 40 52 H 28"
        fill="none" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 32 H 32" fill="none" stroke-width="${width}" stroke-linecap="round"/>`;
const MARK_PATHS = markPaths(8);
/** Logo with a dark outline under the white stroke, readable on any background. */
const OUTLINED_MARK = `<g stroke="#0d1117" stroke-opacity="0.55">${markPaths(11)}</g><g stroke="#ffffff">${MARK_PATHS}</g>`;

const FONT = "DejaVu Sans, Arial, Helvetica, sans-serif";

/** Solid "logo + GeldeSat" badge in the bottom-right corner, with a soft shadow. */
function cornerBadge(w: number, h: number, scale = 1): string {
  const short = Math.min(w, h);
  const badgeH = Math.max(20, Math.round(short * 0.05 * scale));
  const pad = Math.round(badgeH * 0.6);
  const badgeFont = Math.round(badgeH * 0.62);
  const badgeW = badgeH + Math.round(badgeH * 0.25) + Math.round(badgeFont * 4.6) + pad;
  const bx = w - badgeW - pad;
  const by = h - badgeH - pad;
  const badgeIcon = badgeH * 0.72;
  return `
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="${Math.max(1, badgeH / 14)}" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <g transform="translate(${bx} ${by + (badgeH - badgeIcon) / 2}) scale(${badgeIcon / 64})" stroke="#ffffff" opacity="0.92">${MARK_PATHS}</g>
    <text x="${bx + badgeH + badgeH * 0.1}" y="${by + badgeH * 0.72}" font-family="${FONT}"
          font-weight="700" font-size="${badgeFont}" fill="#ffffff" fill-opacity="0.92">GeldeSat</text>
  </g>`;
}

/** One "logo + GeldeSat" unit with its left edge at x=0 and text baseline at y=0. */
function markUnit(font: number): { svg: string; width: number } {
  const icon = font * 1.05;
  const width = icon + font * 0.35 + font * 4.6; // logo + gap + "GeldeSat"
  const svg =
    `<g transform="translate(0 ${(-icon * 0.78).toFixed(1)}) scale(${(icon / 64).toFixed(4)})">${OUTLINED_MARK}</g>` +
    `<text x="${(icon + font * 0.35).toFixed(1)}" y="0">GeldeSat</text>`;
  return { svg, width };
}

/**
 * Listing photos: a sparse diagonal "logo + GeldeSat" pattern over the whole
 * photo (so the mark cannot be cropped or cloned out) plus the corner badge.
 * White with a thin dark outline stays visible on light and dark photos.
 */
function listingWatermarkSvg(w: number, h: number): Buffer {
  const short = Math.min(w, h);
  const font = Math.max(15, Math.round(short / 17));
  const unit = markUnit(font);
  const gapX = unit.width + font * 3.4;
  const gapY = font * 4.6;
  const diag = Math.ceil(Math.hypot(w, h) / 2) + gapX;
  const stroke = Math.max(1, font / 22);

  const tiles: string[] = [];
  for (let row = 0, y = -diag; y <= diag; y += gapY, row++) {
    const shift = row % 2 ? gapX / 2 : 0;
    for (let x = -diag - shift; x <= diag; x += gapX) {
      tiles.push(`<g transform="translate(${(x - unit.width / 2).toFixed(1)} ${y.toFixed(1)})">${unit.svg}</g>`);
    }
  }

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <g transform="translate(${w / 2} ${h / 2}) rotate(-30)" opacity="0.22"
     font-family="${FONT}" font-weight="700" font-size="${font}"
     fill="#ffffff" stroke="#0d1117" stroke-opacity="0.5" stroke-width="${stroke.toFixed(2)}" paint-order="stroke">
    ${tiles.join("")}
  </g>
  ${cornerBadge(w, h)}
</svg>`);
}

/**
 * Chat photos: just two marks, so the photo stays easy to look at: one large,
 * faint mark across the centre and the small corner badge.
 */
function chatWatermarkSvg(w: number, h: number): Buffer {
  const short = Math.min(w, h);
  const font = Math.max(18, Math.round(short / 9));
  const unit = markUnit(font);
  const stroke = Math.max(1, font / 24);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <g transform="translate(${w / 2} ${h / 2}) rotate(-24) translate(${(-unit.width / 2).toFixed(1)} ${(font * 0.35).toFixed(1)})" opacity="0.16"
     font-family="${FONT}" font-weight="700" font-size="${font}"
     fill="#ffffff" stroke="#0d1117" stroke-opacity="0.5" stroke-width="${stroke.toFixed(2)}" paint-order="stroke">
    ${unit.svg}
  </g>
  ${cornerBadge(w, h, 0.85)}
</svg>`);
}

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

/** HEIC/HEIF (iPhone default) by its ISO-BMFF `ftyp` box. */
export function isHeif(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  const box = String.fromCharCode(...bytes.subarray(4, 12));
  return box.startsWith("ftyp") && HEIF_BRANDS.has(box.slice(4));
}

const MAX_INPUT_PIXELS = 80_000_000;

/**
 * sharp's prebuilt libvips cannot decode HEVC-coded HEIC (patent-encumbered),
 * so iPhone photos are decoded with libheif (WebAssembly) and handed to sharp
 * as raw pixels. libheif applies the stored rotation, so no EXIF step is needed.
 */
async function openHeif(input: Uint8Array): Promise<{ image: sharp.Sharp; width: number; height: number }> {
  const { default: decode } = await import("heic-decode");
  let decoded: Awaited<ReturnType<typeof decode>>;
  try {
    decoded = await decode({ buffer: input });
  } catch (err) {
    console.error("[upload] HEIC decode failed", err);
    throw new Error("Fotoğraf okunamadı. HEIC dosyası bozuk olabilir; JPEG olarak deneyin.");
  }
  const { width, height, data } = decoded;
  if (width * height > MAX_INPUT_PIXELS) throw new Error("Fotoğraf çözünürlüğü çok yüksek.");
  const image = sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels: 4 } });
  return { image, width, height };
}

/** Turn an uploaded photo (JPEG/PNG/WebP/HEIC, any size the route accepts) into the stored WebP master. */
export async function processListingPhoto(input: Uint8Array): Promise<Buffer> {
  let base: sharp.Sharp;
  let srcW: number;
  let srcH: number;
  if (isHeif(input)) {
    ({ image: base, width: srcW, height: srcH } = await openHeif(input));
  } else {
    base = sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).rotate();
    const meta = await base.metadata();
    const oriented = (meta.orientation ?? 1) >= 5;
    srcW = (oriented ? meta.height : meta.width) ?? 0;
    srcH = (oriented ? meta.width : meta.height) ?? 0;
  }
  if (!srcW || !srcH) throw new Error("Fotoğraf okunamadı.");
  if (Math.min(srcW, srcH) < MIN_SHORT_EDGE) throw new Error(`Fotoğraf çok küçük. En az ${MIN_SHORT_EDGE} piksel olmalı.`);
  if (Math.max(srcW, srcH) / Math.min(srcW, srcH) > 4) throw new Error("Fotoğraf çok uzun veya çok dar. Lütfen normal bir fotoğraf yükleyin.");

  const scale = Math.min(1, MASTER_LONG_EDGE / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  const resized = await base
    .resize({ width: w, height: h, fit: "fill" })
    .flatten({ background: "#ffffff" }) // transparent PNGs get white, not black
    .composite([{ input: listingWatermarkSvg(w, h) }])
    .toBuffer();

  for (const quality of [80, 72, 64]) {
    const out = await sharp(resized).webp({ quality, effort: 4, smartSubsample: true }).toBuffer();
    if (out.byteLength <= MAX_STORED_BYTES) return out;
  }
  throw new Error("Fotoğraf işlenemedi. Daha küçük bir fotoğraf deneyin.");
}

/** Long edge of chat photos: sharp on any phone, small enough to send quickly. */
const CHAT_LONG_EDGE = 1600;

/**
 * Photo sent in a chat, through the same steps as listing photos: upright,
 * metadata (GPS) stripped, long edge capped, WebP sized to fit, plus a light
 * two-mark watermark.
 */
export async function processChatPhoto(input: Uint8Array): Promise<Buffer> {
  let base: sharp.Sharp;
  let srcW: number;
  let srcH: number;
  if (isHeif(input)) {
    ({ image: base, width: srcW, height: srcH } = await openHeif(input));
  } else {
    base = sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).rotate();
    const meta = await base.metadata();
    const oriented = (meta.orientation ?? 1) >= 5;
    srcW = (oriented ? meta.height : meta.width) ?? 0;
    srcH = (oriented ? meta.width : meta.height) ?? 0;
  }
  if (!srcW || !srcH) throw new Error("Fotoğraf okunamadı.");

  const scale = Math.min(1, CHAT_LONG_EDGE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const prepared = base.resize({ width: w, height: h, fit: "fill" }).flatten({ background: "#ffffff" });
  // Very small images (stickers, screenshots of a few lines) skip the watermark.
  const resized = await (Math.min(w, h) >= 200 ? prepared.composite([{ input: chatWatermarkSvg(w, h) }]) : prepared).toBuffer();

  for (const quality of [78, 70, 62]) {
    const out = await sharp(resized).webp({ quality, effort: 4, smartSubsample: true }).toBuffer();
    if (out.byteLength <= MAX_STORED_BYTES) return out;
  }
  throw new Error("Fotoğraf işlenemedi. Daha küçük bir fotoğraf deneyin.");
}

/** Square 400px WebP profile photo (centre crop, EXIF-oriented, metadata stripped, no watermark). */
export async function processAvatar(input: Uint8Array): Promise<Buffer> {
  const base = isHeif(input)
    ? (await openHeif(input)).image
    : sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  return base
    .resize({ width: 400, height: 400, fit: "cover", position: "attention" })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 82 })
    .toBuffer();
}

/** Smaller copy of a stored photo for cards and thumbnails. */
export async function resizeVariant(input: Uint8Array, width: number): Promise<Buffer> {
  return sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 74, effort: 3 }).toBuffer();
}
