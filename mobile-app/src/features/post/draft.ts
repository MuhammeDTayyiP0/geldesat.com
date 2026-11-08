import type { AttrDef, Category } from '@/api/types';
import { cleanPhone, parseMasked } from '@/lib/format';
import type { PickedPhoto } from '@/lib/photos';

export type PhotoItem = {
  key: string;
  /** Server path once uploaded ("/uploads/…"). */
  url?: string;
  /** Local file shown while uploading or after a failure. */
  localUri?: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  /** When the upload finished: the server drops photos no listing uses after 24 hours. */
  uploadedAt?: number;
  /** The picked file, so a failed or interrupted upload can be tried again (also after a restart). */
  source?: PickedPhoto;
};

export type Draft = {
  path: Category[];
  photos: PhotoItem[];
  title: string;
  price: string;
  description: string;
  attrs: Record<string, string | number>;
  city: string;
  district: string;
  neighborhood: string;
  phone: string;
  /** Sent with a new listing: a retried "Yayınla" returns the listing instead of making a second one. */
  clientKey?: string;
};

export const emptyDraft: Draft = {
  path: [],
  photos: [],
  title: '',
  price: '',
  description: '',
  attrs: {},
  city: '',
  district: '',
  neighborhood: '',
  phone: '',
};

export const MAX_PHOTOS = 10;
export const MAX_PRICE = 1_000_000_000;
export const MIN_YEAR = 1950;
/** Uploaded photos not used by a listing are deleted after 24 hours; keep a margin. */
export const PHOTO_KEEP_MS = 23 * 60 * 60_000;

/** Emlak and vasıta listings need at least one photo (same rule as the website). */
export function needsPhoto(draft: Draft): boolean {
  const root = draft.path[0]?.id;
  return root === 'emlak' || root === 'vasita';
}

export type StepKey = 'category' | 'photos' | 'details' | 'attributes' | 'location' | 'preview';

export const STEP_TITLES: Record<StepKey, string> = {
  category: 'Kategori',
  photos: 'Fotoğraflar',
  details: 'İlan bilgileri',
  attributes: 'Özellikler',
  location: 'Konum ve iletişim',
  preview: 'Önizleme',
};

/** First problem on a step, or null when it is complete. */
export function stepError(
  step: StepKey,
  draft: Draft,
  attributes: AttrDef[],
  context: { profilePhone?: boolean; attributesFailed?: boolean } = {},
): string | null {
  switch (step) {
    case 'category':
      return draft.path.length && draft.path[draft.path.length - 1]?.has_children === false ? null : 'En alt kategoriye kadar seçin.';
    case 'photos':
      if (draft.photos.some((p) => p.status === 'uploading')) return 'Fotoğraflar yükleniyor, lütfen bekleyin.';
      if (draft.photos.some((p) => p.status === 'error')) return 'Yüklenemeyen fotoğrafları silin veya tekrar deneyin.';
      if (needsPhoto(draft) && !draft.photos.length) return 'Emlak ve vasıta ilanlarında en az 1 fotoğraf zorunludur.';
      return null;
    case 'details': {
      const title = draft.title.trim();
      if (title.length < 5) return 'Başlık en az 5 karakter olmalı.';
      const price = parseMasked(draft.price) ?? 0;
      if (price < 1) return 'Geçerli bir fiyat girin.';
      if (price > MAX_PRICE) return 'Fiyat en fazla 1.000.000.000 ₺ olabilir.';
      if (draft.description.trim().length < 10) return 'Açıklama en az 10 karakter olmalı.';
      return null;
    }
    case 'attributes': {
      if (context.attributesFailed) return 'Özellikler yüklenemedi. Tekrar deneyin.';
      const missing = attributes.find((a) => a.required && (draft.attrs[a.name] === undefined || draft.attrs[a.name] === ''));
      if (missing) return `“${missing.name}” alanını doldurun.`;
      // Same range as the site and the server.
      const year = draft.attrs['Yıl'];
      const maxYear = new Date().getFullYear() + 1;
      if (year !== undefined && year !== '' && (Number(year) < MIN_YEAR || Number(year) > maxYear)) return `Yıl ${MIN_YEAR} ile ${maxYear} arasında olmalı.`;
      return null;
    }
    case 'location': {
      if (!draft.city) return 'İl seçin.';
      if (!draft.district) return 'İlçe seçin.';
      const phone = cleanPhone(draft.phone);
      if (phone && !/^05\d{9}$/.test(phone)) return 'Telefon numarası 05xx xxx xx xx biçiminde olmalı.';
      // Said here, not only when publishing fails.
      if (!phone && context.profilePhone === false) return 'İlan vermek için bir telefon numarası yazın.';
      return null;
    }
    default:
      return null;
  }
}
