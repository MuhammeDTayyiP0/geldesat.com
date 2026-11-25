// Self-contained pure-TypeScript QR Code generator (ISO/IEC 18004, Byte mode,
// ECC Level M, Versions 1..10 — supports URLs up to 213 UTF-8 bytes).

type QrVersionSpec = {
  version: number;
  ecPerBlock: number;
  blocks: readonly (readonly [count: number, dataCw: number])[];
  align: readonly number[];
};

const QR_VERSIONS_M: readonly QrVersionSpec[] = [
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

function encodeUtf8(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = ((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
        i += 1;
      }
    }
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(out);
}

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

  pushBits(0b0100, 4);
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
  for (let r = 0; r < n - 1; r += 1) {
    for (let c = 0; c < n - 1; c += 1) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) score += 3;
    }
  }
  let dark = 0;
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (grid[r][c]) dark += 1;
  const pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/** Generates a QR code boolean matrix (`grid[row][col] === true` for dark module). */
export function generateQrMatrix(text: string): boolean[][] {
  const bytes = encodeUtf8(text);
  const { spec, codewords } = buildQrDataCodewords(bytes);
  const size = spec.version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const setFn = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    reserved[r][c] = true;
  };

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

  for (let i = 8; i < size - 8; i += 1) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

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

  setFn(4 * spec.version + 9, 8, true);

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
