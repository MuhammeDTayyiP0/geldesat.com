/** Tolerant parsers for admin URL search params: bad values fall back to defaults instead of erroring. */

export function str(v: unknown, max = 200): string | undefined {
  if (typeof v === "number") return String(v);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export function int(v: unknown, min: number, max: number): number | undefined {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.trunc(x))) : undefined;
}

export function oneOf<T extends string>(v: unknown, values: readonly T[]): T | undefined {
  return typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Downloads rows as a UTF-8 CSV that Excel opens with Turkish characters intact. */
export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [header, ...rows].map((r) => r.map(escape).join(";")).join("\r\n");
  const blob = new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
