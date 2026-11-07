/** True when version `a` ("1.2.3") is older than `b`. Unreadable versions never count as older. */
export function isOlderVersion(a: string | null | undefined, b: string | null | undefined): boolean {
  const parse = (v: string | null | undefined) => (v && /^\d+(\.\d+){0,2}$/.test(v.trim()) ? v.trim().split('.').map(Number) : null);
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d < 0;
  }
  return false;
}
