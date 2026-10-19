/**
 * Browser-side preparation before upload. The server does the real work
 * (orientation, resize, watermark, WebP, metadata stripping, HEIC conversion); here we only
 * apply the user's rotation and shrink very large camera photos so uploads
 * stay quick on mobile data. The photo's aspect ratio is never changed.
 */

const MAX_INPUT_BYTES = 30 * 1024 * 1024;
/** Server accepts up to 12 MB; anything over this is re-encoded smaller first. */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const SEND_AS_IS_BYTES = 2.5 * 1024 * 1024;
const MAX_LONG_EDGE = 2560;

export type PhotoRotation = 0 | 90 | 180 | 270;

const HEIC = /\.(heic|heif)$/i;
const SERVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** File input `accept` list: common web formats plus iPhone HEIC (converted on the server). */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

/** iPhone HEIC/HEIF; some browsers report an empty type, so the extension counts too. */
export function isHeicFile(file: File): boolean {
  return file.type === "image/heic" || file.type === "image/heif" || HEIC.test(file.name);
}

/** Readable error for a file the browser cannot handle, or null when it looks usable. */
export function checkPhotoFile(file: File): string | null {
  if (isHeicFile(file)) {
    return file.size > MAX_UPLOAD_BYTES ? "HEIC fotoğraf en fazla 12 MB olabilir." : null;
  }
  if (!file.type.startsWith("image/")) return "Yalnızca fotoğraf dosyaları yüklenebilir.";
  if (file.size > MAX_INPUT_BYTES) return "Fotoğraf 30 MB'dan büyük olamaz.";
  return null;
}

async function decode(file: File): Promise<ImageBitmap> {
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

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Fotoğraf hazırlanamadı"))), "image/jpeg", quality),
  );
}

/** File ready to upload: the original when it is already small and unrotated, else an upright JPEG copy. */
export async function preparePhoto(file: File, rotate: PhotoRotation = 0): Promise<Blob> {
  const problem = checkPhotoFile(file);
  if (problem) throw new Error(problem);
  if (rotate === 0 && file.size <= SEND_AS_IS_BYTES && SERVER_TYPES.has(file.type)) return file;
  // Most browsers cannot decode HEIC; the server converts it, so send it untouched.
  if (isHeicFile(file) && rotate === 0) return file;

  const bitmap = await decode(file);
  try {
    const quarter = rotate === 90 || rotate === 270;
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = quarter ? h : w;
    canvas.height = quarter ? w : h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Fotoğraf hazırlanamadı");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff"; // transparent PNGs become white, as on the server
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
    const blob = await toBlob(canvas, 0.9);
    canvas.width = canvas.height = 0; // release the backing store early on phones
    return blob;
  } finally {
    bitmap.close();
  }
}

type PhotoWidth = 240 | 480 | 800 | 1200;

function isStoredPhoto(url: string): boolean {
  return url.startsWith("/uploads/") || url.startsWith("/api/mobile/images/");
}

/** Resized copy of a stored listing photo (server-generated WebP). Other URLs pass through. */
export function photoSrc(url: string, width: PhotoWidth): string {
  return isStoredPhoto(url) ? `${url}?w=${width}` : url;
}

/** `srcset` over the given widths for a stored photo; undefined for external URLs. */
export function photoSrcSet(url: string, widths: readonly PhotoWidth[]): string | undefined {
  return isStoredPhoto(url) ? widths.map((w) => `${url}?w=${w} ${w}w`).join(", ") : undefined;
}
