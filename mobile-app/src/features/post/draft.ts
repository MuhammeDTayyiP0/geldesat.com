import type { AttrDef, Category } from '@/api/types';
import { cleanPhone, parseMasked } from '@/lib/format';

export type PhotoItem = {
  key: string;
  /** Server path once uploaded ("/uploads/…"). */
  url?: string;
  /** Local file shown while uploading or after a failure. */
  localUri?: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
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
export function stepError(step: StepKey, draft: Draft, attributes: AttrDef[]): string | null {
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
      if ((parseMasked(draft.price) ?? 0) < 1) return 'Geçerli bir fiyat girin.';
      if (draft.description.trim().length < 10) return 'Açıklama en az 10 karakter olmalı.';
      return null;
    }
    case 'attributes': {
      const missing = attributes.find((a) => a.required && (draft.attrs[a.name] === undefined || draft.attrs[a.name] === ''));
      return missing ? `“${missing.name}” alanını doldurun.` : null;
    }
    case 'location': {
      if (!draft.city) return 'İl seçin.';
      if (!draft.district) return 'İlçe seçin.';
      const phone = cleanPhone(draft.phone);
      if (phone && !/^05\d{9}$/.test(phone)) return 'Telefon numarası 05xx xxx xx xx biçiminde olmalı.';
      return null;
    }
    default:
      return null;
  }
}
