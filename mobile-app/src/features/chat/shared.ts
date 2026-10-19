/** Chat helpers kept in step with web/src/lib/chat-shared.ts. */

export const DELETE_WINDOW_MS = 60 * 60_000;
export const DELETED_MESSAGE_TEXT = 'Bu mesaj silindi';
export const LISTING_PHOTO_MSG = '::ilan-foto::';
export const MAX_TEMPLATES = 15;
export const MAX_TEMPLATE_LENGTH = 300;

export const BUYER_QUICK_REPLIES = [
  'Merhaba, ilan hâlâ satılık mı?',
  'Pazarlık payı var mı?',
  'Ürünü ne zaman görebilirim?',
  'Takas düşünür müsünüz?',
  'Kargo ile gönderim yapıyor musunuz?',
];

export const SELLER_QUICK_REPLIES = [
  'Merhaba, evet hâlâ satılık.',
  'Fiyatta küçük bir pazarlık payı var.',
  'Fiyat sabittir, kusura bakmayın.',
  'Hafta içi akşamları görüşebiliriz.',
  'Maalesef satıldı.',
];

export const REPORT_REASONS = ['Sahte / dolandırıcılık', 'Yanlış kategori', 'Yasaklı ürün', 'Mükerrer ilan', 'Küfür / hakaret', 'Diğer'];

export const CHAT_REPORT_REASONS = ['Dolandırıcılık şüphesi', 'Taciz / hakaret', 'Spam', 'Diğer'];

const RISK_PATTERNS: { re: RegExp; warning: string }[] = [
  { re: /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/i, warning: 'IBAN paylaşıldı. Ürünü görmeden para göndermeyin.' },
  { re: /\b(kapora|kaparo|ön ?ödeme|peşinat)\b/i, warning: 'Ürünü görmeden kapora veya ön ödeme göndermeyin.' },
  { re: /\b(whatsapp|telegram|wa\.me|t\.me)\b/i, warning: 'Site dışına taşınan yazışmalarda GeldeSat sizi koruyamaz.' },
  {
    re: /\b(shopier|papara|ininal|bit\.ly|tinyurl|odeme|ödeme linki|güvenli ödeme)\b/i,
    warning: 'Dış ödeme bağlantılarına tıklamayın; sahte ödeme sayfası olabilir.',
  },
];

export function messageRisk(text: string): string | null {
  for (const { re, warning } of RISK_PATTERNS) if (re.test(text)) return warning;
  return null;
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/gi;

export function linkify(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
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

export function previewText(kind: string, content: string, deleted: boolean): string {
  if (deleted) return DELETED_MESSAGE_TEXT;
  if (content === LISTING_PHOTO_MSG) return 'İlan görseli';
  if (kind === 'image') return '📷 Fotoğraf';
  if (kind === 'location') return content.startsWith('📍') ? content : `📍 ${content}`;
  return content;
}

export function mapsUrl(meta: { lat?: number; lng?: number; label?: string }): string {
  const q = meta.lat != null && meta.lng != null ? `${meta.lat},${meta.lng}` : (meta.label ?? '');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function chatImagePath(imageId: string): string {
  return `/api/chat/image/${encodeURIComponent(imageId)}`;
}
