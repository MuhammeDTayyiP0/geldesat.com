/** Display helpers shared by the admin console screens. */

export type Tone = "muted" | "primary" | "ok" | "warn" | "danger" | "ink" | "violet";

const nf = new Intl.NumberFormat("tr-TR");
const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });

export function n(value: number | null | undefined): string {
  return nf.format(value ?? 0);
}

export function nCompact(value: number | null | undefined): string {
  const v = value ?? 0;
  return Math.abs(v) < 10_000 ? nf.format(v) : compact.format(v);
}

export function money(value: number, currency = "TRY"): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = value / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${units[i]}`;
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function dateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

/** "3 dk önce", "2 gün önce", "5 gün sonra". */
export function relative(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const suffix = diff < 0 ? "önce" : "sonra";
  const m = Math.round(abs / 60_000);
  if (m < 1) return diff < 0 ? "az önce" : "birazdan";
  if (m < 60) return `${m} dk ${suffix}`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa ${suffix}`;
  const days = Math.round(h / 24);
  if (days < 31) return `${days} gün ${suffix}`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} ay ${suffix}`;
  return `${Math.round(months / 12)} yıl ${suffix}`;
}

/** Waiting time for queues: "12 dk", "3 sa", "2 gün". */
export function age(value: string | null | undefined): string {
  if (!value) return "—";
  const m = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (m < 60) return `${m} dk`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} sa`;
  return `${Math.round(h / 24)} gün`;
}

export function isExpired(status: string, expiresAt: string | null): boolean {
  return status === "ACTIVE" && !!expiresAt && new Date(expiresAt).getTime() <= Date.now();
}

export const LISTING_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Onay bekliyor", tone: "warn" },
  ACTIVE: { label: "Yayında", tone: "ok" },
  EXPIRED: { label: "Süresi doldu", tone: "muted" },
  INACTIVE: { label: "Pasif", tone: "muted" },
  SOLD: { label: "Satıldı", tone: "primary" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
};

export function listingStatus(status: string, expiresAt: string | null) {
  if (isExpired(status, expiresAt)) return LISTING_STATUS.EXPIRED;
  return LISTING_STATUS[status] ?? { label: status, tone: "muted" as Tone };
}

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Havale bekliyor", tone: "warn" },
  PAID: { label: "Onaylandı", tone: "ok" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
  CANCELLED: { label: "İptal edildi", tone: "muted" },
};

export const ATTRIBUTE_TYPE_LABEL: Record<string, string> = {
  SELECT: "Tek seçim",
  MULTI: "Çoklu seçim",
  NUMBER: "Sayı",
  BOOLEAN: "Evet / Hayır",
  TEXT: "Serbest metin",
};

export const TARGET_LABEL: Record<string, string> = {
  listing: "İlan",
  user: "Üye",
  category: "Kategori",
  attribute: "Özellik",
  report: "Şikayet",
  review: "Yorum",
  store: "Mağaza",
  order: "Ödeme",
  page: "Sayfa",
  settings: "Ayarlar",
  broadcast: "Duyuru",
  system: "Sistem",
};

/** Tone for an audit action, by its verb. */
export function actionTone(action: string): Tone {
  if (/delete|reject|ban|sessions/.test(action)) return "danger";
  if (/approve|activate|unban|paid|create|verify/.test(action)) return "ok";
  if (/settings|system|broadcast/.test(action)) return "violet";
  return "primary";
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toLocaleUpperCase("tr");
}

export function errorMessage(err: unknown, fallback = "İşlem başarısız."): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** % change between two periods; null when there is nothing to compare against. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}
