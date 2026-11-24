import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { photoSrc } from "@/lib/images";
import { formatPrice } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Self-contained pure-TypeScript QR Code generator (ISO/IEC 18004, Byte mode,
// ECC Level M, Versions 1..10 — supports URLs up to 213 UTF-8 bytes).
// ---------------------------------------------------------------------------

type QrVersionSpec = {
  version: number;
  ecPerBlock: number;
  blocks: ReadonlyArray<readonly [count: number, dataCw: number]>;
  align: ReadonlyArray<number>;
};

const QR_VERSIONS_M: ReadonlyArray<QrVersionSpec> = [
  { version: 1, ecPerBlock: 10, blocks: [[1, 16]], align: [] },
  { version: 2, ecPerBlock: 16, blocks: [[1, 28]], align: [6, 18] },
  { version: 3, ecPerBlock: 26, blocks: [[1, 44]], align: [6, 22] },
  { version: 4, ecPerBlock: 18, blocks: [[2, 32]], align: [6, 26] },
  { version: 5, ecPerBlock: 24, blocks: [[2, 43]], align: [6, 30] },
  { version: 6, ecPerBlock: 16, blocks: [[4, 27]], align: [6, 34] },
  { version: 7, ecPerBlock: 18, blocks: [[4, 31]], align: [6, 22, 38] },
  { version: 8, ecPerBlock: 22, blocks: [[2, 38], [2, 39]], align: [6, 24, 42] },
  { version: 9, ecPerBlock: 22, blocks: [[3, 36], [2, 37]], align: [6, 26, 46] },
  { version: 10, ecPerBlock: 26, blocks: [[4, 43], [1, 44]], align: [6, 28, 50] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGenerator(ecLen);
  const buf = new Uint8Array(data.length + ecLen);
  buf.set(data);
  for (let i = 0; i < data.length; i += 1) {
    const factor = buf[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j += 1) {
      buf[i + j] ^= gfMul(gen[j], factor);
    }
  }
  return buf.slice(data.length);
}

function buildQrDataCodewords(bytes: Uint8Array): { spec: QrVersionSpec; codewords: number[] } {
  const chosen = QR_VERSIONS_M.find((v) => {
    const totalData = v.blocks.reduce((acc, [c, d]) => acc + c * d, 0);
    const countBits = v.version >= 10 ? 16 : 8;
    const overheadBytes = Math.ceil((4 + countBits) / 8);
    return bytes.length + overheadBytes <= totalData;
  });
  const spec = chosen ?? QR_VERSIONS_M[QR_VERSIONS_M.length - 1];
  const totalData = spec.blocks.reduce((acc, [c, d]) => acc + c * d, 0);
  const countBits = spec.version >= 10 ? 16 : 8;
  const maxBytes = Math.floor((totalData * 8 - 4 - countBits) / 8);
  const payload = bytes.slice(0, maxBytes);

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((val >>> i) & 1);
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(payload.length, countBits);
  for (const b of payload) pushBits(b, 8);
  const capacityBits = totalData * 8;
  const termLen = Math.min(4, capacityBits - bits.length);
  pushBits(0, termLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    dataBytes.push(byte);
  }
  const pad = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < totalData) {
    dataBytes.push(pad[padIdx % 2]);
    padIdx += 1;
  }

  // Split into RS blocks and interleave data + error-correction codewords
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const [count, dataLen] of spec.blocks) {
    for (let i = 0; i < count; i += 1) {
      const slice = Uint8Array.from(dataBytes.slice(offset, offset + dataLen));
      offset += dataLen;
      dataBlocks.push(slice);
      ecBlocks.push(rsRemainder(slice, spec.ecPerBlock));
    }
  }

  const interleaved: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i += 1) {
    for (const b of dataBlocks) if (i < b.length) interleaved.push(b[i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (const b of ecBlocks) interleaved.push(b[i]);
  }
  return { spec, codewords: interleaved };
}

function qrFormatBits(mask: number): number {
  // ECC Level M = 00
  const data = mask & 0b111;
  let rem = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if (rem & (1 << i)) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function qrVersionBits(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i -= 1) {
    if (rem & (1 << i)) rem ^= 0x1f25 << (i - 12);
  }
  return (version << 12) | rem;
}

function maskMatches(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function qrPenaltyScore(grid: boolean[][]): number {
  const n = grid.length;
  let score = 0;
  // Rule 1: 5+ same-colored modules in row/col
  for (let r = 0; r < n; r += 1) {
    let runRow = 1;
    let runCol = 1;
    for (let c = 1; c < n; c += 1) {
      if (grid[r][c] === grid[r][c - 1]) runRow += 1;
      else {
        if (runRow >= 5) score += 3 + (runRow - 5);
        runRow = 1;
      }
      if (grid[c][r] === grid[c - 1][r]) runCol += 1;
      else {
        if (runCol >= 5) score += 3 + (runCol - 5);
        runCol = 1;
      }
    }
    if (runRow >= 5) score += 3 + (runRow - 5);
    if (runCol >= 5) score += 3 + (runCol - 5);
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < n - 1; r += 1) {
    for (let c = 0; c < n - 1; c += 1) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) score += 3;
    }
  }
  // Rule 4: dark module balance
  let dark = 0;
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (grid[r][c]) dark += 1;
  const pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

function encodeQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const { spec, codewords } = buildQrDataCodewords(bytes);
  const size = spec.version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const setFn = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    reserved[r][c] = true;
  };

  // Finder patterns + 1-module white separator
  const drawFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inBox = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const isDark =
          inBox &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setFn(r, c, isDark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  for (const ar of spec.align) {
    for (const ac of spec.align) {
      if ((ar < 9 && ac < 9) || (ar < 9 && ac >= size - 8) || (ar >= size - 8 && ac < 9)) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFn(ar + dr, ac + dc, dist === 0 || dist === 2);
        }
      }
    }
  }

  // Dark module
  setFn(4 * spec.version + 9, 8, true);

  // Reserve format info cells
  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true;
    if (i < 7) reserved[size - 1 - i][8] = true;
  }

  // Version info (V7+)
  if (spec.version >= 7) {
    const vBits = qrVersionBits(spec.version);
    for (let i = 0; i < 18; i += 1) {
      const dark = Boolean((vBits >>> i) & 1);
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      setFn(r, c, dark);
      setFn(c, r, dark);
    }
  }

  // Place data bits in zig-zag order
  const bitStream: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i -= 1) bitStream.push((cw >>> i) & 1);
  }
  let bitIdx = 0;
  let up = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol -= 1;
    for (let step = 0; step < size; step += 1) {
      const r = up ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc += 1) {
        const c = rightCol - dc;
        if (reserved[r][c]) continue;
        modules[r][c] = bitIdx < bitStream.length ? bitStream[bitIdx] === 1 : false;
        bitIdx += 1;
      }
    }
    up = !up;
  }

  // Try all 8 masks and keep lowest penalty
  let bestGrid = modules;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const grid = modules.map((row, r) =>
      row.map((val, c) => (reserved[r][c] ? val : maskMatches(mask, r, c) ? !val : val)),
    );
    const fmt = qrFormatBits(mask);
    const topLeftCols = [0, 1, 2, 3, 4, 5, 7, 8];
    const topLeftRows = [7, 5, 4, 3, 2, 1, 0];
    for (let i = 0; i < 8; i += 1) grid[8][topLeftCols[i]] = Boolean((fmt >>> (14 - i)) & 1);
    for (let i = 0; i < 7; i += 1) grid[topLeftRows[i]][8] = Boolean((fmt >>> (6 - i)) & 1);
    for (let i = 0; i < 7; i += 1) grid[size - 1 - i][8] = Boolean((fmt >>> (14 - i)) & 1);
    for (let i = 0; i < 8; i += 1) grid[8][size - 8 + i] = Boolean((fmt >>> (7 - i)) & 1);

    const score = qrPenaltyScore(grid);
    if (score < bestScore) {
      bestScore = score;
      bestGrid = grid;
    }
  }
  return bestGrid;
}

// ---------------------------------------------------------------------------
// Canvas rendering helpers
// ---------------------------------------------------------------------------

const CARD_W = 1080;
const CARD_H = 1350;

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i += 1) {
    const candidate = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = words[i];
      if (lines.length === maxLines - 1) {
        // Fit remaining words into last line with ellipsis if needed
        const rest = words.slice(i).join(" ");
        let trimmed = rest;
        while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
          trimmed = trimmed.slice(0, -1);
        }
        lines.push(rest === trimmed ? trimmed : `${trimmed.trimEnd()}…`);
        return lines;
      }
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawPlaceholderPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, "#1e3a8a");
  grad.addColorStop(1, "#3b82f6");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 74, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = '700 40px "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GeldeSat", x + w / 2, y + h / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawQrCode(ctx: CanvasRenderingContext2D, matrix: boolean[][], x: number, y: number, size: number) {
  const quiet = 2;
  const cells = matrix.length + quiet * 2;
  const cell = size / cells;

  ctx.save();
  roundRectPath(ctx, x - 12, y - 12, size + 24, size + 24, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < matrix.length; c += 1) {
      if (!matrix[r][c]) continue;
      ctx.fillRect(
        Math.floor(x + (c + quiet) * cell),
        Math.floor(y + (r + quiet) * cell),
        Math.ceil(cell),
        Math.ceil(cell),
      );
    }
  }
  ctx.restore();
}

export type ShareCardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  title: string;
  price: number;
  currency: string;
  city: string | null;
  district: string | null;
  listingNo: number;
  image?: string | null;
};

export function ShareCardDialog({
  open,
  onOpenChange,
  slug,
  title,
  price,
  currency,
  city,
  district,
  listingNo,
  image,
}: ShareCardDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shareUrl = `https://www.geldesat.com/ilan/${slug}`;
  const locationText = [district, city].filter(Boolean).join(", ") || "Türkiye";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRendering(true);

    const draw = async () => {
      const img = image ? await loadImage(photoSrc(image, 1200)) : null;
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = CARD_W;
      canvas.height = CARD_H;

      // Background
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      // Top brand header
      const headerGrad = ctx.createLinearGradient(0, 0, CARD_W, 136);
      headerGrad.addColorStop(0, "#1a4fd8");
      headerGrad.addColorStop(1, "#2563eb");
      ctx.fillStyle = headerGrad;
      ctx.fillRect(0, 0, CARD_W, 136);

      // Brand badge
      roundRectPath(ctx, 56, 38, 60, 60, 16);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = '800 34px "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("G", 86, 70);

      ctx.textAlign = "left";
      ctx.font = '800 38px "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText("GeldeSat", 134, 70);

      // Listing number pill on header right
      ctx.font = '600 24px "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
      const noLabel = `#${listingNo}`;
      const noWidth = ctx.measureText(noLabel).width + 40;
      roundRectPath(ctx, CARD_W - 56 - noWidth, 44, noWidth, 48, 24);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(noLabel, CARD_W - 56 - noWidth / 2, 69);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      // Main card container
      const cardX = 48;
      const cardY = 176;
      const cardW = CARD_W - 96;
      const cardH = CARD_H - 224;
      roundRectPath(ctx, cardX, cardY, cardW, cardH, 32);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Photo frame
      const photoX = cardX + 28;
      const photoY = cardY + 28;
      const photoW = cardW - 56;
      const photoH = 580;

      ctx.save();
      roundRectPath(ctx, photoX, photoY, photoW, photoH, 24);
      ctx.clip();
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const scale = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        ctx.drawImage(img, photoX + (photoW - drawW) / 2, photoY + (photoH - drawH) / 2, drawW, drawH);
      } else {
        drawPlaceholderPhoto(ctx, photoX, photoY, photoW, photoH);
      }
      ctx.restore();

      // Price
      const contentX = cardX + 36;
      let cursorY = photoY + photoH + 68;
      ctx.fillStyle = "#1a4fd8";
      ctx.font = '800 56px "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(formatPrice(price, currency), contentX, cursorY);

      // Title
      cursorY += 56;
      ctx.fillStyle = "#0f172a";
      ctx.font = '700 36px "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
      const lines = wrapLines(ctx, title, cardW - 72, 2);
      for (const line of lines) {
        ctx.fillText(line, contentX, cursorY);
        cursorY += 48;
      }

      // Location + footer divider
      const footerY = cardY + cardH - 252;
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(contentX, footerY - 24);
      ctx.lineTo(cardX + cardW - 36, footerY - 24);
      ctx.stroke();

      // Left metadata block
      ctx.fillStyle = "#475569";
      ctx.font = '600 28px "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(locationText, contentX, footerY + 34);

      ctx.fillStyle = "#64748b";
      ctx.font = '500 24px "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`İlan No: #${listingNo}`, contentX, footerY + 80);

      ctx.fillStyle = "#1a4fd8";
      ctx.font = '600 24px "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText("İlanı incelemek için QR kodu okutun", contentX, footerY + 140);

      ctx.fillStyle = "#94a3b8";
      ctx.font = '500 20px "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText("www.geldesat.com", contentX, footerY + 176);

      // QR Code on bottom-right
      const qrSize = 188;
      const qrMatrix = encodeQrMatrix(shareUrl);
      drawQrCode(ctx, qrMatrix, cardX + cardW - 36 - qrSize, footerY + 6, qrSize);

      setRendering(false);
    };

    void draw();
    return () => {
      cancelled = true;
    };
  }, [open, image, listingNo, price, currency, title, locationText, shareUrl]);

  function getBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `geldesat-${listingNo}.png`;
      a.click();
      toast.success("Paylaşım kartı indirildi");
    } catch {
      toast.error("Görsel oluşturulamadı");
    }
  }

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await getBlob();
      const file = blob ? new File([blob], `geldesat-${listingNo}.png`, { type: "image/png" }) : null;
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title,
          text: `${title} – ${formatPrice(price, currency)}`,
          files: [file],
        });
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title,
          text: `${title} – ${formatPrice(price, currency)}`,
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success("İlan bağlantısı kopyalandı");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("Paylaşılamadı");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Kodlu Paylaşım Kartı</DialogTitle>
          <DialogDescription>İlanınızı sosyal medyada paylaşmak için görseli indirin veya doğrudan paylaşın.</DialogDescription>
        </DialogHeader>

        <div className="relative flex justify-center">
          <canvas
            ref={canvasRef}
            className="aspect-[4/5] w-full max-w-[320px] rounded-xl border border-border bg-elevated shadow-sm"
            aria-label={`${title} paylaşım kartı önizlemesi`}
          />
          {rendering ? (
            <div className="absolute inset-0 grid place-items-center rounded-xl bg-surface/60 backdrop-blur-[1px]">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={handleDownload} disabled={rendering} className="flex-1">
            <Download className="size-4" /> PNG İndir
          </Button>
          <Button type="button" onClick={() => void handleShare()} disabled={rendering || sharing} className="flex-1">
            <Share2 className="size-4" /> {sharing ? "Paylaşılıyor…" : "Paylaş"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
