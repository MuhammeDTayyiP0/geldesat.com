export const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type QuietHours = {
  enabled: boolean;
  start: string;
  end: string;
};

export type SellerPrefs = {
  accept_offers: boolean;
  call_hours_enabled: boolean;
  call_hours_start: string;
  call_hours_end: string;
  away_mode: boolean;
  away_message: string;
};

export type BrowseSort = "date_desc" | "price_asc" | "price_desc" | "distance";
export type BrowseView = "grid" | "list";

export type BrowsePrefs = {
  default_city: string;
  default_sort: BrowseSort;
  default_view: BrowseView;
};

export type UserPrefs = {
  quiet_hours: QuietHours;
  seller_prefs: SellerPrefs;
  browse_prefs: BrowsePrefs;
};

export const DEFAULT_USER_PREFS: UserPrefs = {
  quiet_hours: { enabled: false, start: "23:00", end: "08:00" },
  seller_prefs: {
    accept_offers: true,
    call_hours_enabled: false,
    call_hours_start: "09:00",
    call_hours_end: "21:00",
    away_mode: false,
    away_message: "",
  },
  browse_prefs: {
    default_city: "",
    default_sort: "date_desc",
    default_view: "grid",
  },
};

function hhmm(val: unknown, fallback: string): string {
  return typeof val === "string" && HHMM_RE.test(val) ? val : fallback;
}

export function resolveUserPrefs(raw: unknown): UserPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const qh = (r.quiet_hours && typeof r.quiet_hours === "object" ? r.quiet_hours : {}) as Record<string, unknown>;
  const sp = (r.seller_prefs && typeof r.seller_prefs === "object" ? r.seller_prefs : {}) as Record<string, unknown>;
  const bp = (r.browse_prefs && typeof r.browse_prefs === "object" ? r.browse_prefs : {}) as Record<string, unknown>;

  const rawSort = bp.default_sort;
  const default_sort: BrowseSort =
    rawSort === "price_asc" || rawSort === "price_desc" || rawSort === "distance" ? rawSort : "date_desc";
  const default_view: BrowseView = bp.default_view === "list" ? "list" : "grid";

  return {
    quiet_hours: {
      enabled: qh.enabled === true,
      start: hhmm(qh.start, DEFAULT_USER_PREFS.quiet_hours.start),
      end: hhmm(qh.end, DEFAULT_USER_PREFS.quiet_hours.end),
    },
    seller_prefs: {
      accept_offers: sp.accept_offers !== false,
      call_hours_enabled: sp.call_hours_enabled === true,
      call_hours_start: hhmm(sp.call_hours_start, DEFAULT_USER_PREFS.seller_prefs.call_hours_start),
      call_hours_end: hhmm(sp.call_hours_end, DEFAULT_USER_PREFS.seller_prefs.call_hours_end),
      away_mode: sp.away_mode === true,
      away_message: typeof sp.away_message === "string" ? sp.away_message.trim().slice(0, 200) : "",
    },
    browse_prefs: {
      default_city: typeof bp.default_city === "string" ? bp.default_city.trim().slice(0, 40) : "",
      default_sort,
      default_view,
    },
  };
}

function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/** True when `now` falls inside the user's Turkey-time quiet-hours window. */
export function isInQuietHours(qh: QuietHours, now: Date = new Date()): boolean {
  if (!qh.enabled) return false;
  if (!HHMM_RE.test(qh.start) || !HHMM_RE.test(qh.end)) return false;
  const startMin = toMinutes(qh.start);
  const endMin = toMinutes(qh.end);
  if (startMin === endMin) return false;

  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [hh, mm] = formatted.split(":").map(Number);
  const currentMin = (hh % 24) * 60 + mm;

  if (startMin < endMin) {
    return currentMin >= startMin && currentMin < endMin;
  }
  return currentMin >= startMin || currentMin < endMin;
}

export const FEEDBACK_CATEGORIES = [
  { value: "bug", label: "Hata bildir" },
  { value: "suggestion", label: "Özellik önerisi" },
  { value: "account", label: "Hesap / ilan desteği" },
  { value: "other", label: "Diğer" },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["value"];

export const BROWSE_SORT_LABELS: Record<BrowseSort, string> = {
  date_desc: "En yeni ilanlar",
  price_asc: "Fiyat: Düşükten yükseğe",
  price_desc: "Fiyat: Yüksekten düşüğe",
  distance: "Konuma en yakın",
};
