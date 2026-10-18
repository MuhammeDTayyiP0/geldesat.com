const MARK = "GeldeSat";
const MAX_SIDE = 1280;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;
/** Server limit is 2 MB; staying well under it keeps uploads fast on mobile data. */
const TARGET_BYTES = { "image/webp": 300_000, "image/jpeg": 450_000 } as const;

export type PhotoRotation = 0 | 90 | 180 | 270;
/** `contain` keeps the whole photo on a blurred backdrop; `cover` crops it to fill 4:3. */
export type PhotoFit = "contain" | "cover";
export type PhotoEdit = { rotate: PhotoRotation; fit: PhotoFit };
export const DEFAULT_EDIT: PhotoEdit = { rotate: 0, fit: "contain" };

const HEIC = /\.(heic|heif)$/i;

/** Readable error for a file the browser cannot process, or null when it looks usable. */
export function checkPhotoFile(file: File): string | null {
  if (file.type === "image/heic" || file.type === "image/heif" || HEIC.test(file.name)) {
    return "HEIC fotoğraflar desteklenmiyor. Telefonunuzda “En Uyumlu” biçimi seçin veya JPEG olarak kaydedin.";
  }
  if (!file.type.startsWith("image/")) return "Yalnızca fotoğraf dosyaları yüklenebilir.";
  if (file.size > MAX_INPUT_BYTES) return "Fotoğraf 30 MB'dan büyük olamaz.";
  return null;
}

/** Light diagonal watermark plus a corner mark; enough to deter reuse without hiding the item. */
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);
  const size = Math.max(14, Math.round(Math.min(w, h) / 13));
  ctx.font = `600 ${size}px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.strokeStyle = "rgba(13, 17, 23, 0.10)";
  ctx.lineWidth = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gapX = size * 10;
  const gapY = size * 6;
  for (let y = -h; y <= h; y += gapY) {
    const offset = (Math.round(y / gapY) % 2) * (gapX / 2);
    for (let x = -w; x <= w; x += gapX) {
      ctx.strokeText(MARK, x + offset, y);
      ctx.fillText(MARK, x + offset, y);
    }
  }
  ctx.restore();

  ctx.save();
  const corner = Math.max(13, Math.round(w / 30));
  ctx.font = `700 ${corner}px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText(MARK, w - corner * 0.8, h - corner * 0.8);
  ctx.restore();
}

/**
 * Fill the canvas with a blurred, darkened copy of the photo so letterboxed
 * portrait shots get a soft background instead of empty bars. Downscaling to a
 * tiny canvas and back blurs in every browser (ctx.filter is not universal).
 */
function drawBlurredBackdrop(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, w: number, h: number) {
  const tiny = document.createElement("canvas");
  tiny.width = 24;
  tiny.height = 18;
  const tctx = tiny.getContext("2d");
  if (tctx) {
    const s = Math.max(tiny.width / sw, tiny.height / sh);
    tctx.drawImage(src, (tiny.width - sw * s) / 2, (tiny.height - sh * s) / 2, sw * s, sh * s);
    ctx.drawImage(tiny, 0, 0, w, h);
  } else {
    ctx.fillStyle = "#eef1f5";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = "rgba(13, 17, 23, 0.18)";
  ctx.fillRect(0, 0, w, h);
}

async function bitmapFrom(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      throw new Error("Bu fotoğraf açılamadı. Farklı bir fotoğraf deneyin veya JPEG olarak kaydedin.");
    }
  }
}

/** Upright copy of the bitmap after the user's rotation. */
function rotated(bitmap: ImageBitmap, rotate: PhotoRotation): { src: CanvasImageSource; w: number; h: number } {
  if (rotate === 0) return { src: bitmap, w: bitmap.width, h: bitmap.height };
  const quarter = rotate === 90 || rotate === 270;
  const c = document.createElement("canvas");
  c.width = quarter ? bitmap.height : bitmap.width;
  c.height = quarter ? bitmap.width : bitmap.height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi");
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return { src: c, w: c.width, h: c.height };
}

let webpSupported: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupported !== null) return webpSupported;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    webpSupported = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupported = false;
  }
  return webpSupported;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Görsel işlenemedi"))), type, quality),
  );
}

/**
 * Turn a camera/gallery photo into a 4:3 watermarked listing image (max 1280px)
 * as a WebP blob, or JPEG where WebP encoding is missing.
 */
export async function processPhoto(file: File, edit: PhotoEdit = DEFAULT_EDIT): Promise<Blob> {
  const problem = checkPhotoFile(file);
  if (problem) throw new Error(problem);
  const bitmap = await bitmapFrom(file);
  try {
    const { src, w: sw, h: sh } = rotated(bitmap, edit.rotate);
    const landscape = sw / sh >= 4 / 3;
    const cw = Math.min(MAX_SIDE, landscape ? sw : Math.round((sh * 4) / 3));
    const ch = Math.max(1, Math.round((cw * 3) / 4));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, cw);
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Görsel işlenemedi");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const scale =
      edit.fit === "cover" ? Math.max(canvas.width / sw, ch / sh) : Math.min(canvas.width / sw, ch / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    if (edit.fit === "contain" && (dw < canvas.width || dh < ch)) {
      drawBlurredBackdrop(ctx, src, sw, sh, canvas.width, ch);
    }
    ctx.drawImage(src, Math.round((canvas.width - dw) / 2), Math.round((ch - dh) / 2), dw, dh);
    drawWatermark(ctx, canvas.width, ch);

    const type = supportsWebp() ? "image/webp" : "image/jpeg";
    let last: Blob | null = null;
    for (const q of [0.84, 0.74, 0.62, 0.5]) {
      last = await toBlob(canvas, type, q);
      if (last.size <= TARGET_BYTES[type]) return last;
    }
    // Still large (very detailed photo): shrink a quarter and settle.
    const small = document.createElement("canvas");
    small.width = Math.round(canvas.width * 0.75);
    small.height = Math.round(ch * 0.75);
    const sctx = small.getContext("2d");
    if (!sctx) return last!;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(canvas, 0, 0, small.width, small.height);
    return toBlob(small, type, 0.6);
  } finally {
    bitmap.close();
  }
}
