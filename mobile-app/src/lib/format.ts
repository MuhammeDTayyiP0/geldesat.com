const priceFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

export function formatPrice(value: number | string | null | undefined, currency = 'TRY'): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return '—';
  const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `;
  return currency === 'TRY' ? `${priceFormatter.format(n)} ${symbol}` : `${symbol}${priceFormatter.format(n)}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return '—';
  return priceFormatter.format(n);
}

/** Digits only, with Turkish thousands dots while typing ("1500000" → "1.500.000"). */
export function maskThousands(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
  return digits ? priceFormatter.format(Number(digits)) : '';
}

export function parseMasked(input: string): number | undefined {
  const digits = input.replace(/\D/g, '');
  return digits ? Number(digits) : undefined;
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function formatTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Inbox stamp: 14:32 today, "Dün", weekday this week, else 12.10.2026 (as on the website). */
export function inboxTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = startOfDay(new Date());
  const day = 86_400_000;
  if (d.getTime() >= today) return formatTime(d);
  if (d.getTime() >= today - day) return 'Dün';
  if (d.getTime() >= today - 6 * day) return WEEKDAYS[d.getDay()];
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Day separator label inside a chat. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const t = startOfDay(d);
  if (t === today) return 'Bugün';
  if (t === today - 86_400_000) return 'Dün';
  return formatDate(d);
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} gün önce`;
  return formatDate(d);
}

export function lastSeenLabel(online: boolean, lastSeen: string | null): string {
  if (online) return 'Çevrimiçi';
  if (!lastSeen) return '';
  const d = new Date(lastSeen);
  const today = startOfDay(new Date());
  if (d.getTime() >= today) return `Son görülme bugün ${formatTime(d)}`;
  if (d.getTime() >= today - 86_400_000) return `Son görülme dün ${formatTime(d)}`;
  return `Son görülme ${formatDate(d)}`;
}

export function memberSince(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}'den beri üye`;
}

export function listingStatusLabel(status: string, expired = false): string {
  if (expired && status === 'ACTIVE') return 'Süresi doldu';
  switch (status) {
    case 'PENDING':
      return 'Onay bekliyor';
    case 'ACTIVE':
      return 'Yayında';
    case 'INACTIVE':
      return 'Yayında değil';
    case 'SOLD':
      return 'Satıldı';
    case 'REJECTED':
      return 'Reddedildi';
    default:
      return status;
  }
}

export function locationLabel(city?: string | null, district?: string | null, neighborhood?: string | null): string {
  return [neighborhood, district, city].filter(Boolean).join(', ');
}

/** "05321234567" → "0532 123 45 67" */
export function formatPhone(raw: string | null | undefined): string {
  const digits = cleanPhone(raw);
  if (digits.length !== 11) return raw ?? '';
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
}

export function cleanPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('5')) digits = `0${digits}`;
  return digits.slice(0, 11);
}

/** Typing mask for a Turkish mobile number: "0532 123 45 67". */
export function maskPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits && !digits.startsWith('0')) digits = `0${digits}`;
  digits = digits.slice(0, 11);
  const parts = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)].filter(Boolean);
  return parts.join(' ');
}

export function plural(n: number, word: string): string {
  return `${formatNumber(n)} ${word}`;
}
