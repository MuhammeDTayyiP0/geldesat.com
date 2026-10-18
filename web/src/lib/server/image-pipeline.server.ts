import sharp from "sharp";

/**
 * Listing photo pipeline, done on the server the way large marketplaces do it:
 * keep the photo's own aspect ratio (no padding bars), honour EXIF rotation,
 * strip metadata (GPS, camera serials), cap the long edge, add a watermark and
 * store one WebP master. Smaller sizes are derived on request (see `resizeVariant`).
 */

const MASTER_LONG_EDGE = 1600;
const MIN_SHORT_EDGE = 240;
/** Stored masters must fit the 2 MB column check in mobile_listing_images. */
const MAX_STORED_BYTES = 2 * 1024 * 1024;
/** Widths the site asks for in cards, thumbnails and the gallery. */
export const VARIANT_WIDTHS = [240, 480, 800] as const;

const MARK_PATHS = `
  <path d="M36 12 H 24 A 12 12 0 0 0 12 24 V 28 A 4 4 0 0 0 16 32 H 48 A 4 4 0 0 1 52 36 V 40 A 12 12 0 0 1 40 52 H 28"
        fill="none" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 32 H 32" fill="none" stroke-width="8" stroke-linecap="round"/>`;

/** Faint centred logo (deters cropping the corner badge out) plus a readable corner badge. */
function watermarkSvg(w: number, h: number): Buffer {
  const short = Math.min(w, h);
  const center = Math.round(short * 0.34);
  const badgeH = Math.max(22, Math.round(short * 0.055));
  const pad = Math.round(badgeH * 0.6);
  const font = Math.round(badgeH * 0.62);
  const textW = Math.round(font * 4.6);
  const badgeW = badgeH + Math.round(badgeH * 0.25) + textW + pad;
  const bx = w - badgeW - pad;
  const by = h - badgeH - pad;
  const icon = badgeH * 0.72;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="${Math.max(1, badgeH / 14)}" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g transform="translate(${(w - center) / 2} ${(h - center) / 2}) scale(${center / 64})" stroke="#ffffff" opacity="0.16">${MARK_PATHS}</g>
  <g filter="url(#s)">
    <g transform="translate(${bx} ${by + (badgeH - icon) / 2}) scale(${icon / 64})" stroke="#ffffff" opacity="0.92">${MARK_PATHS}</g>
    <text x="${bx + badgeH + badgeH * 0.1}" y="${by + badgeH * 0.72}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif"
          font-weight="700" font-size="${font}" fill="#ffffff" fill-opacity="0.92">GeldeSat</text>
  </g>
</svg>`);
}

/** Turn an uploaded photo (JPEG/PNG/WebP, any size the route accepts) into the stored WebP master. */
export async function processListingPhoto(input: Uint8Array): Promise<Buffer> {
  const base = sharp(input, { failOn: "error", limitInputPixels: 80_000_000 }).rotate();
  const meta = await base.metadata();
  const oriented = (meta.orientation ?? 1) >= 5;
  const srcW = (oriented ? meta.height : meta.width) ?? 0;
  const srcH = (oriented ? meta.width : meta.height) ?? 0;
  if (!srcW || !srcH) throw new Error("Fotoğraf okunamadı.");
  if (Math.min(srcW, srcH) < MIN_SHORT_EDGE) throw new Error(`Fotoğraf çok küçük. En az ${MIN_SHORT_EDGE} piksel olmalı.`);
  if (Math.max(srcW, srcH) / Math.min(srcW, srcH) > 4) throw new Error("Fotoğraf çok uzun veya çok dar. Lütfen normal bir fotoğraf yükleyin.");

  const scale = Math.min(1, MASTER_LONG_EDGE / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  const resized = await base
    .resize({ width: w, height: h, fit: "fill" })
    .flatten({ background: "#ffffff" }) // transparent PNGs get white, not black
    .composite([{ input: watermarkSvg(w, h) }])
    .toBuffer();

  for (const quality of [80, 72, 64]) {
    const out = await sharp(resized).webp({ quality, effort: 4, smartSubsample: true }).toBuffer();
    if (out.byteLength <= MAX_STORED_BYTES) return out;
  }
  throw new Error("Fotoğraf işlenemedi. Daha küçük bir fotoğraf deneyin.");
}

/** Smaller copy of a stored photo for cards and thumbnails. */
export async function resizeVariant(input: Uint8Array, width: number): Promise<Buffer> {
  return sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 74, effort: 3 }).toBuffer();
}
