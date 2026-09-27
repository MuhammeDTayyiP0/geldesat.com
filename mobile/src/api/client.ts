import { Platform } from 'react-native';

/**
 * geldesat.com Canlı API Adresi
 * Mobil cihazların gerçek veritabanına bağlanması için doğrudan ana domain kullanılır.
 */
export const API_BASE_URL = 'https://www.geldesat.com';

export interface ApiListingResponse {
  success: boolean;
  error?: string;
  total: number;
  limit: number;
  offset: number;
  listings: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    city: string | null;
    district: string | null;
    images: string[];
    attrs: Record<string, string | number>;
    created_at: string;
    category_name?: string;
    category_slug?: string;
    seller_name?: string;
    boosts?: string[];
    featured_until?: string | null;
  }>;
}

export interface ApiCategoryResponse {
  success: boolean;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    icon: string | null;
    sort_order: number;
  }>;
}

export interface ApiConfigResponse {
  success: boolean;
  homeSections: string[];
  features: Record<string, boolean>;
  mobileApp: {
    min_ios_version?: string;
    min_android_version?: string;
    announcement?: string | null;
  };
  abTests: {
    listing_card_layout: 'grid' | 'list';
  };
}

export interface MobileProfile {
  display_name: string;
  phone: string;
  bio: string;
  city: string;
  district: string;
  listing_count: number;
  active_count: number;
  favorite_count: number;
  rating_avg: number;
  rating_count: number;
}

export interface MobileProfileResponse {
  success: boolean;
  error?: string;
  profile?: MobileProfile;
  store?: { id: string; name: string; slug: string; plan: string; city: string; description: string } | null;
  savedSearches?: Array<{ id: string; label: string; query: string; filters: string }>;
}

export async function getMobileProfile(token: string): Promise<MobileProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/api/mobile/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Profil bilgileri alınamadı.');
  return data;
}

export async function updateMobileProfile(
  token: string,
  profile: Pick<MobileProfile, 'display_name' | 'phone' | 'bio' | 'city' | 'district'>,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/mobile/profile`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) throw new Error(data?.error || 'Profil kaydedilemedi.');
}

export async function updateMobileStore(
  token: string,
  store: { name: string; description: string; city: string; phone: string },
): Promise<{ id: string; slug: string }> {
  const response = await fetch(`${API_BASE_URL}/api/mobile/profile`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'store', ...store }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false || !data?.store) throw new Error(data?.error || 'Mağaza bilgileri kaydedilemedi.');
  return data.store;
}

export async function deleteMobileSavedSearch(token: string, id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/mobile/profile?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) throw new Error(data?.error || 'Kayıtlı arama silinemedi.');
}

export async function mobileChangePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: API_BASE_URL,
      Referer: `${API_BASE_URL}/`,
    },
    body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: false }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.message || data?.error?.message || 'Şifre değiştirilemedi.');
}

/**
 * İlanları filtreli ve sayfalı olarak çeker.
 */
export async function getMobileListings(params: {
  category?: string;
  q?: string;
  urgent?: boolean;
  featured?: boolean;
  city?: string;
  sort?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ApiListingResponse> {
  const query = new URLSearchParams();
  if (params.category) query.append('category', params.category);
  if (params.q) query.append('q', params.q);
  if (params.urgent) query.append('urgent', 'true');
  if (params.featured) query.append('featured', 'true');
  if (params.city) query.append('city', params.city);
  if (params.sort) query.append('sort', params.sort);
  if (params.limit) query.append('limit', String(params.limit));
  if (params.offset) query.append('offset', String(params.offset));

  try {
    const res = await fetch(`${API_BASE_URL}/api/mobile/listings?${query.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Yerel geliştirme durumunda yedek adrese bağlanmayı dene
    try {
      const localUrl = Platform.OS === 'android' ? 'http://192.168.1.123:8080' : 'http://localhost:8080';
      const localRes = await fetch(`${localUrl}/api/mobile/listings?${query.toString()}`);
      if (localRes.ok) return await localRes.json();
    } catch {}
    return {
      success: false,
      error: 'İlanlara şu anda ulaşılamıyor. İnternet bağlantınızı kontrol edip yeniden deneyin.',
      total: 0,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      listings: [],
    };
  }
}

import { EMBEDDED_CATEGORIES } from '../data/categoriesData';

/**
 * Tüm kategori ağacını çeker.
 * Sitenin veritabanındaki 10 ana kök ve yüzlerce alt kategoriyi anında yükler.
 */
export async function getMobileCategories(): Promise<ApiCategoryResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/mobile/categories`);
    if (res.ok) {
      const data = await res.json();
      if (data?.categories?.length > 0) {
        return data;
      }
    }
  } catch {}

// Canlı sunucuda yeni endpoint henüz dağıtılmamış olsa dahi veritabanı kategorilerini anında sunar
  return {
    success: true,
    categories: EMBEDDED_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parent_id: c.parent_id,
      icon: c.icon ?? null,
      sort_order: c.sort_order,
    })),
  };
}

/**
 * Server-Driven UI vitrin sırasını ve A/B test varyantını çeker.
 */
export async function getMobileConfig(deviceId?: string): Promise<ApiConfigResponse> {
  const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
  try {
    const res = await fetch(`${API_BASE_URL}/api/mobile/config${query}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return {
      success: true,
      homeSections: ['hero', 'categories', 'featured'],
      features: { ab_testing: true },
      mobileApp: { min_ios_version: '1.0.0', min_android_version: '1.0.0' },
      abTests: { listing_card_layout: 'grid' },
    };
  }
}
