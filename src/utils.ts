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
