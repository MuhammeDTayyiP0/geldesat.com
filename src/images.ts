const MARK = "GeldeSat";

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#eef1f5";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 5);
  const size = Math.max(16, Math.round(Math.min(w, h) / 14));
  ctx.font = `600 ${size}px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(26, 79, 216, 0.07)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gapX = size * 7;
  const gapY = size * 4;
  for (let y = -h; y <= h; y += gapY) {
    for (let x = -w; x <= w; x += gapX) {
      ctx.fillText(MARK, x, y);
    }
  }
  ctx.restore();
}

function drawOverlayMark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 5);
  const size = Math.max(14, Math.round(Math.min(w, h) / 16));
  ctx.font = `600 ${size}px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.strokeStyle = "rgba(13, 17, 23, 0.18)";
  ctx.lineWidth = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gapX = size * 8;
  const gapY = size * 5;
  for (let y = -h; y <= h; y += gapY) {
    for (let x = -w; x <= w; x += gapX) {
      ctx.strokeText(MARK, x, y);
      ctx.fillText(MARK, x, y);
    }
  }
  ctx.restore();
  ctx.save();
  ctx.font = `600 ${Math.max(12, Math.round(w / 28))}px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.textAlign = "right";
  ctx.fillText(MARK, w - 12, h - 12);
  ctx.restore();
}

async function bitmapFrom(file: File) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    return createImageBitmap(file);
  }
}

export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Yalnızca görsel dosyaları");
  if (file.size > 8 * 1024 * 1024) throw new Error("Dosya 8 MB'dan büyük olamaz");
  const bitmap = await bitmapFrom(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const iw = Math.max(1, Math.round(bitmap.width * scale));
  const ih = Math.max(1, Math.round(bitmap.height * scale));
  let cw: number;
  let ch: number;
  if (iw / ih >= 4 / 3) {
    cw = iw;
    ch = Math.max(1, Math.round((iw * 3) / 4));
  } else {
    ch = ih;
    cw = Math.max(1, Math.round((ih * 4) / 3));
  }
  const cap = Math.min(1, max / Math.max(cw, ch));
  cw = Math.max(1, Math.round(cw * cap));
  ch = Math.max(1, Math.round(ch * cap));
  const dw = Math.max(1, Math.round(iw * cap));
  const dh = Math.max(1, Math.round(ih * cap));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawBackdrop(ctx, cw, ch);
  ctx.drawImage(bitmap, Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), dw, dh);
  drawOverlayMark(ctx, cw, ch);
  const data = canvas.toDataURL("image/jpeg", 0.7);
  if (data.length > 420_000) {
    const smaller = canvas.toDataURL("image/jpeg", 0.52);
    if (smaller.length > 420_000) throw new Error("Görsel hâlâ çok büyük, başka bir kare deneyin");
    return smaller;
  }
  return data;
}
