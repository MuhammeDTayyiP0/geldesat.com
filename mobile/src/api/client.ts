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
  page?: number;
  pages?: number;
  listings: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    city: string | null;
    district: string | null;
    neighborhood?: string | null;
    category_id?: string;
    images: string[];
    attrs: Record<string, string | number>;
    created_at: string;
    category_name?: string;
    category_slug?: string;
    seller_name?: string;
    user_id?: string;
    store_name?: string;
    store_slug?: string;
    lat?: number | null;
    lng?: number | null;
    boosts?: string[];
    featured_until?: string | null;
    status?: string;
    view_count?: number;
    expires_at?: string | null;
  }>;
}

export interface ApiCategoryResponse {
  success: boolean;
  counts?: Record<string, number>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    icon: string | null;
    sort_order: number;
  }>;
}

export interface MobileAttribute {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'MULTI' | string;
  options: string[] | null;
  unit: string | null;
  required: boolean;
}

export async function getMobileCategoryAttributes(categoryId: string) {
  return mobileRequest<{ success: true; attributes: MobileAttribute[] }>(
    `/api/mobile/category-attributes?categoryId=${encodeURIComponent(categoryId)}`,
  );
}

export interface MobileSellerProfile {
  id: string;
  name: string;
  bio: string;
  city: string;
  since: string;
  listing_count: number;
  rating_avg: number;
  rating_count: number;
  store: { name: string; slug: string; plan: string } | null;
  reviews: Array<{ id: string; rating: number; comment: string; reviewer: string; at: string }>;
}

export async function getMobileSeller(id: string) {
  return mobileRequest<{ success: true; seller: MobileSellerProfile; listings: ApiListingResponse['listings'] }>(
    `/api/mobile/sellers/${encodeURIComponent(id)}`,
  );
}

export interface MobileStore {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  plan: string;
}

export async function getMobileStore(slug: string) {
  return mobileRequest<{ success: true; store: MobileStore; listings: ApiListingResponse['listings'] }>(
    `/api/mobile/stores/${encodeURIComponent(slug)}`,
  );
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
  district?: string;
  neighborhood?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  minYear?: string | number;
  maxYear?: string | number;
  minKm?: string | number;
  maxKm?: string | number;
  minM2?: string | number;
  maxM2?: string | number;
  attrs?: Record<string, string | string[] | number>;
  limit?: number;
  offset?: number;
} = {}): Promise<ApiListingResponse> {
  const query = new URLSearchParams();
  if (params.category) query.append('category', params.category);
  if (params.q) query.append('q', params.q);
  if (params.urgent) query.append('urgent', 'true');
  if (params.featured) query.append('featured', 'true');
  if (params.city) query.append('city', params.city);
  if (params.district) query.append('district', params.district);
  if (params.neighborhood) query.append('neighborhood', params.neighborhood);
  if (params.sort) query.append('sort', params.sort);
  for (const key of ['minPrice', 'maxPrice', 'minYear', 'maxYear', 'minKm', 'maxKm', 'minM2', 'maxM2'] as const) {
    const value = params[key];
    if (value !== undefined && String(value).trim()) query.append(key, String(value));
  }
  if (params.attrs && Object.keys(params.attrs).length) query.append('attrs', JSON.stringify(params.attrs));
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

async function mobileRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) throw new Error(data?.error || 'İstek tamamlanamadı.');
  return data as T;
}

export async function getMobileListing(id: string, token?: string) {
  const response = await mobileRequest<{
    success: true;
    listing: ApiListingResponse['listings'][number] & { status: string; expires_at?: string | null };
    isFavorite: boolean;
    isOwner: boolean;
    history?: Array<{ price: number; at: string }>;
    similar?: ApiListingResponse['listings'];
    reviews?: Array<{ id: string; rating: number; comment: string; reviewer: string; at: string }>;
    sellerStats?: { rating_avg: number; rating_count: number } | null;
    favoriteCount?: number;
    phoneRevealCount?: number;
    reviewEligibility?: { eligible: boolean; existing: { rating: number; comment: string | null } | null } | null;
  }>(`/api/mobile/listings/${encodeURIComponent(id)}`, token);
  return {
    ...response,
    history: response.history ?? [],
    similar: response.similar ?? [],
    reviews: response.reviews ?? [],
    sellerStats: response.sellerStats ?? { rating_avg: 0, rating_count: 0 },
    favoriteCount: response.favoriteCount ?? 0,
    phoneRevealCount: response.phoneRevealCount ?? 0,
    reviewEligibility: response.reviewEligibility ?? { eligible: false, existing: null },
  };
}

export async function submitMobileReview(listingId: string, rating: number, comment: string, token: string) {
  return mobileRequest<{ success: true }>('/api/mobile/reviews', token, { method: 'POST', body: JSON.stringify({ listingId, rating, comment }) });
}

export async function reportMobileListing(listingId: string, reason: string, details: string, token: string) {
  return mobileRequest<{ success: true }>('/api/mobile/reports', token, { method: 'POST', body: JSON.stringify({ listingId, reason, details }) });
}

export async function revealMobileListingPhone(id: string, token: string) {
  return mobileRequest<{ success: true; phone: string }>(`/api/mobile/listings/${encodeURIComponent(id)}`, token, { method: 'POST' });
}

export async function getMobileFavorites(token: string) {
  return mobileRequest<{ success: true; listings: ApiListingResponse['listings'] }>('/api/mobile/favorites', token);
}

export async function toggleMobileFavorite(listingId: string, token: string) {
  return mobileRequest<{ success: true; favorite: boolean }>('/api/mobile/favorites', token, { method: 'POST', body: JSON.stringify({ listingId }) });
}

export interface MobileConversation {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_image?: string | null;
  listing_price?: number | null;
  currency?: string;
  other_user_name: string;
  other_user_id?: string;
  blocked?: boolean;
  blockedByMe?: boolean;
  blockedByOther?: boolean;
  last_message: string;
  last_sender_id?: string;
  updated_at: string;
  unread_count: number;
  messages?: Array<{ id: string; sender_id: string; content: string; created_at: string; read_at?: string | null }>;
}

export async function getMobileConversations(token: string) {
  return mobileRequest<{ success: true; conversations: MobileConversation[] }>('/api/mobile/conversations', token);
}

export async function startMobileConversation(listingId: string, content: string, token: string) {
  return mobileRequest<{ success: true; conversationId: string }>('/api/mobile/conversations', token, { method: 'POST', body: JSON.stringify({ listingId, content }) });
}

export async function getMobileConversation(id: string, token: string) {
  return mobileRequest<{ success: true; thread: MobileConversation }>(`/api/mobile/conversations/${encodeURIComponent(id)}`, token);
}

export async function sendMobileMessage(id: string, content: string, token: string) {
  return mobileRequest<{ success: true; message: NonNullable<MobileConversation['messages']>[number] }>(`/api/mobile/conversations/${encodeURIComponent(id)}`, token, { method: 'POST', body: JSON.stringify({ content }) });
}

export async function setMobileUserBlocked(userId: string, blocked: boolean, token: string) {
  return mobileRequest<{ success: true; blocked: boolean }>('/api/mobile/blocks', token, { method: 'POST', body: JSON.stringify({ userId, blocked }) });
}

export interface MobileNotification {
  id: string; type: string; title: string; body: string; link: string; read: boolean; created_at: string;
}

export async function getMobileNotifications(token: string) {
  return mobileRequest<{ success: true; notifications: MobileNotification[]; unread: number }>('/api/mobile/notifications', token);
}

export async function markMobileNotificationsRead(token: string) {
  return mobileRequest<{ success: true }>('/api/mobile/notifications', token, { method: 'POST' });
}

export async function getMobileMyListings(token: string) {
  return mobileRequest<{ success: true; listings: ApiListingResponse['listings'] }>('/api/mobile/my-listings', token);
}

export async function getMobileMyListing(id: string, token: string) {
  return mobileRequest<{ success: true; listing: ApiListingResponse['listings'][number] & { status: string; phone?: string } }>(`/api/mobile/my-listings/${encodeURIComponent(id)}`, token);
}

export async function createMobileListing(listing: Record<string, unknown>, token: string) {
  return mobileRequest<{ success: true; id: string; slug: string; status: string }>('/api/mobile/my-listings', token, { method: 'POST', body: JSON.stringify(listing) });
}

export async function updateMobileListingAction(id: string, action: 'status' | 'delete' | 'renew', token: string, status?: string) {
  return mobileRequest<{ success: true }>(`/api/mobile/my-listings/${encodeURIComponent(id)}`, token, { method: 'POST', body: JSON.stringify({ action, status }) });
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
    counts: {},
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
