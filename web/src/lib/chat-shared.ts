/** Message shapes and helpers shared by the chat server functions and the chat UI. */

export type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export type ChatMessage = {
  id: string;
  sender_id: string;
  /** Readable text; for photos and offers a fallback ("📷 Fotoğraf", "Teklif: …"). */
  content: string;
  kind: "text" | "image" | "offer";
  meta: { image_id?: string; amount?: number; status?: OfferStatus } | null;
  deleted: boolean;
  created_at: string;
  read_at: string | null;
};

/** Sender may delete a message for everyone within this window. */
export const DELETE_WINDOW_MS = 60 * 60_000;

export const DELETED_MESSAGE_TEXT = "Bu mesaj silindi";

export function chatImageUrl(imageId: string): string {
  return `/api/chat/image/${encodeURIComponent(imageId)}`;
}

export const BUYER_QUICK_REPLIES = [
  "Merhaba, ilan hâlâ satılık mı?",
  "Pazarlık payı var mı?",
  "Ürünü ne zaman görebilirim?",
  "Takas düşünür müsünüz?",
  "Kargo ile gönderim yapıyor musunuz?",
];

export const SELLER_QUICK_REPLIES = [
  "Merhaba, evet hâlâ satılık.",
  "Fiyatta küçük bir pazarlık payı var.",
  "Fiyat sabittir, kusura bakmayın.",
  "Hafta içi akşamları görüşebiliriz.",
  "Maalesef satıldı.",
];

/**
 * Patterns scammers use: IBAN, deposit requests, moving to WhatsApp/Telegram,
 * or outside payment links. Matching messages get a warning under them.
 */
const RISK_PATTERNS: Array<{ re: RegExp; warning: string }> = [
  { re: /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/i, warning: "IBAN paylaşıldı. Ürünü görmeden para göndermeyin." },
  { re: /\b(kapora|kaparo|ön ?ödeme|peşinat)\b/i, warning: "Ürünü görmeden kapora veya ön ödeme göndermeyin." },
  { re: /\b(whatsapp|telegram|wa\.me|t\.me)\b/i, warning: "Site dışına taşınan yazışmalarda GeldeSat sizi koruyamaz." },
  { re: /\b(shopier|papara|ininal|bit\.ly|tinyurl|odeme|ödeme linki|güvenli ödeme)\b/i, warning: "Dış ödeme bağlantılarına tıklamayın; sahte ödeme sayfası olabilir." },
];

export function messageRisk(text: string): string | null {
  for (const { re, warning } of RISK_PATTERNS) if (re.test(text)) return warning;
  return null;
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/gi;

/** Split text into plain and link parts for rendering. */
export function linkify(text: string): Array<{ text: string; href?: string }> {
  const parts: Array<{ text: string; href?: string }> = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: text.slice(last, i) });
    parts.push({ text: m[0], href: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Inbox timestamp: 14:32 today, "Dün", weekday this week, else 12.10.2026. */
export function inboxTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  if (d.getTime() >= startOfToday) return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (d.getTime() >= startOfToday - day) return "Dün";
  if (d.getTime() >= startOfToday - 6 * day) return d.toLocaleDateString("tr-TR", { weekday: "long" });
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Inbox preview for the last message. */
export function previewText(kind: string, content: string, deleted: boolean): string {
  if (deleted) return DELETED_MESSAGE_TEXT;
  if (content === "::ilan-foto::") return "İlan görseli";
  if (kind === "image") return "📷 Fotoğraf";
  return content;
}
