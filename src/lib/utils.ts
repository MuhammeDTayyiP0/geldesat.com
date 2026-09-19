import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value: number | string, currency = "TRY") {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("tr-TR").format(n);
}

export function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export const LISTING_PHOTO_MSG = "::ilan-foto::";

export function listingStatusLabel(status: string, expired = false) {
  if (expired && status === "ACTIVE") return "Süresi doldu";
  switch (status) {
    case "PENDING":
      return "Onay bekliyor";
    case "ACTIVE":
      return "Yayında";
    case "INACTIVE":
      return "Yayında değil";
    case "SOLD":
      return "Satıldı";
    case "REJECTED":
      return "Reddedildi";
    default:
      return status;
  }
}

export function slugify(input: string) {
  return input
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function newId(prefix = "") {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return prefix ? `${prefix}_${id}` : id;
}

export function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export function num(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function timeAgo(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} gün`;
  return formatDate(d);
}

export function asIso(value: unknown, fallback?: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (fallback) return fallback;
  return new Date().toISOString();
}

export function pingInbox() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("geldesat:inbox"));
}

/**
 * Extract canonical 11-digit TR phone digits (05XXXXXXXXX).
 */
export function cleanPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("5") && digits.length <= 10) {
    digits = `0${digits}`;
  }
  return digits.slice(0, 11);
}

/**
 * Format any raw phone number to standard TR visual format: "05XX XXX XX XX".
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = cleanPhone(raw);
  if (!digits) return "";

  const p1 = digits.slice(0, 4); // 05XX
  const p2 = digits.slice(4, 7); // XXX
  const p3 = digits.slice(7, 9); // XX
  const p4 = digits.slice(9, 11); // XX

  let res = p1;
  if (p2) res += ` ${p2}`;
  if (p3) res += ` ${p3}`;
  if (p4) res += ` ${p4}`;
  return res;
}

/**
 * Live mask algorithm as user types/pastes into input field.
 */
export function maskPhoneInput(val: string): string {
  if (!val) return "";
  let digits = val.replace(/\D/g, "");

  if (digits.startsWith("90") && digits.length > 2) {
    digits = digits.slice(2);
  }

  if (digits.length === 1 && digits === "5") {
    digits = "05";
  } else if (digits.length > 0 && !digits.startsWith("0")) {
    digits = `0${digits}`;
  }

  digits = digits.slice(0, 11);

  const p1 = digits.slice(0, 4);
  const p2 = digits.slice(4, 7);
  const p3 = digits.slice(7, 9);
  const p4 = digits.slice(9, 11);

  let res = p1;
  if (p2) res += ` ${p2}`;
  if (p3) res += ` ${p3}`;
  if (p4) res += ` ${p4}`;
  return res;
}

