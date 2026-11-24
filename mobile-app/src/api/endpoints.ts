import { Platform } from 'react-native';
import { request, rpc, toQuery } from './client';
import { buildImageForm, UPLOAD_HEADER, type LocalImage } from './uploadForm';
import type {
  AccountSettings,
  AppNotification,
  AttrDef,
  BlockedUser,
  BrowseResult,
  Category,
  CategoryInfo,
  ChatMessage,
  Conversation,
  FollowStatus,
  FollowedSellerSummary,
  Listing,
  ListingDetail,
  RecentListing,
  ListingForEdit,
  ListingInput,
  Me,
  MobileConfig,
  NotifyPrefs,
  PhoneVisibility,
  SavedSearch,
  SavedSearchFilters,
  SearchFilters,
  SearchResult,
  Seller,
  Store,
  StoreApplication,
  Thread,
} from './types';

// ─── Catalog ────────────────────────────────────────────────────────────────

export const catalog = {
  /** Sends the session token when signed in: feature flags are decided per person. */
  config: (params: { deviceId: string; platform: string; appVersion?: string }) => request<MobileConfig>(`/api/mobile/config${toQuery(params)}`),
  stats: () => rpc<{ listings: number; cities: number }>('statsHome'),
  roots: () => rpc<{ roots: Category[]; counts: Record<string, number> }>('listCategoryRoots'),
  browse: (path: string[]) => rpc<BrowseResult>('browseCategories', { path }),
  category: (slug: string) => rpc<CategoryInfo>('getCategory', { slug }),
  attributes: (categoryId: string) =>
    request<{ attributes: AttrDef[] }>(`/api/mobile/category-attributes${toQuery({ categoryId })}`, { auth: false }).then((r) => r.attributes),
  search: (filters: SearchFilters) => rpc<SearchResult>('searchCatalogWithContext', filters),
  /** Same visibility and sort rules as search; used for home rails. */
  listings: (params: SearchFilters & { offset?: number }) =>
    request<{ listings: Listing[]; total: number; pages?: number }>(`/api/mobile/listings${toQuery(params)}`, { auth: false }),
  homeRails: () =>
    rpc<{ urgent: Listing[]; featured: Listing[]; latest: Listing[]; latestPages: number; priceDropped: Listing[] }>('homeListings'),
  legal: (slug: string) => rpc<{ slug: string; title: string; body: string } | null>('getLegal', { slug }),
  cityCounts: () => rpc<{ city: string; n: number }[]>('mapCityCounts'),
  byIds: (ids: string[]) => rpc<Listing[]>('getListingsByIds', { ids }),
  inBounds: (params: {
    north: number;
    south: number;
    east: number;
    west: number;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    q?: string;
  }) => rpc<Listing[]>('mapListingsInBounds', params),
};

// ─── Listings ───────────────────────────────────────────────────────────────

export const listings = {
  detail: (id: string) => request<ListingDetail>(`/api/mobile/listings/${encodeURIComponent(id)}`),
  revealPhone: (id: string) =>
    request<{ phone: string }>(`/api/mobile/listings/${encodeURIComponent(id)}`, { method: 'POST' }).then((r) => r.phone),
  favorites: () => request<{ listings: Listing[] }>('/api/mobile/favorites').then((r) => r.listings),
  toggleFavorite: (listingId: string) =>
    request<{ favorite: boolean }>('/api/mobile/favorites', { method: 'POST', body: { listingId } }).then((r) => r.favorite),
  report: (listingId: string, reason: string, details?: string) =>
    request('/api/mobile/reports', { method: 'POST', body: { listingId, reason, details } }),
  review: (listingId: string, rating: number, comment?: string) =>
    request('/api/mobile/reviews', { method: 'POST', body: { listingId, rating, comment } }),
  /** The account's last 50 viewed listings (recorded by the server when a detail opens). */
  recent: () => rpc<RecentListing[]>('myRecentListings'),
  /** Remove one listing from the history, or all of it with `null`. */
  removeRecent: (listingId: string | null) => rpc('removeRecentListing', { listingId }),
  seller: (id: string, offset = 0, reviewsPage = 1) =>
    request<{ seller: Seller; listings: Listing[] }>(
      `/api/mobile/sellers/${encodeURIComponent(id)}${toQuery({
        offset: offset || undefined,
        reviewsPage: reviewsPage > 1 ? reviewsPage : undefined,
      })}`,
    ),
  store: (slug: string) => request<{ store: Store; listings: Listing[] }>(`/api/mobile/stores/${encodeURIComponent(slug)}`),
};

// ─── My listings ────────────────────────────────────────────────────────────

export const myListings = {
  list: () => request<{ listings: Listing[] }>('/api/mobile/my-listings').then((r) => r.listings),
  forEdit: (id: string) => rpc<ListingForEdit>('getListingForEdit', { id }),
  save: (input: ListingInput) =>
    request<{ id: string; slug: string; status: string }>('/api/mobile/my-listings', { method: 'POST', body: input }),
  action: (id: string, body: { action: 'delete' | 'renew' } | { action: 'status'; status: 'ACTIVE' | 'INACTIVE' | 'SOLD' }) =>
    request(`/api/mobile/my-listings/${encodeURIComponent(id)}`, { method: 'POST', body }),
};

// ─── Account ────────────────────────────────────────────────────────────────

export const account = {
  me: () => rpc<Me>('getMe'),
  updateProfile: (data: { display_name: string; phone?: string; bio?: string; city?: string; district?: string }) =>
    rpc<{ ok: true }>('updateProfile', data),
  updateStore: (data: { name: string; description?: string; city?: string; phone?: string }) =>
    rpc<{ id: string; slug: string }>('upsertStore', data),
  counts: () => rpc<{ notifications: number; messages: number; admin: boolean }>('unreadCount'),
  notifications: () => request<{ notifications: AppNotification[]; unread: number }>('/api/mobile/notifications'),
  markNotificationsRead: () => request('/api/mobile/notifications', { method: 'POST', body: {} }),
  registerPush: (token: string) =>
    request('/api/mobile/notifications', {
      method: 'POST',
      body: { action: 'register-push', token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    }),
  /** `sessionToken`: sign-out has already cleared the session in the app. */
  unregisterPush: (token: string, sessionToken: string) =>
    request('/api/mobile/notifications', {
      method: 'POST',
      body: { action: 'unregister-push', token },
      auth: false,
      headers: { Authorization: `Bearer ${sessionToken}` },
      timeoutMs: 8_000,
    }),
  settings: () => rpc<AccountSettings>('getAccountSettings'),
  updatePrivacy: (data: { phone_visibility: PhoneVisibility; show_whatsapp: boolean; read_receipts: boolean }) =>
    rpc('updatePrivacySettings', data),
  updateMessageEmail: (enabled: boolean) => rpc('updateMessageEmail', { enabled }),
  updateNotifyPrefs: (prefs: NotifyPrefs) => rpc<{ prefs: NotifyPrefs }>('updateNotifyPrefs', prefs),
  deletionStatus: () => rpc<{ purgeAt: string | null }>('getDeletionStatus'),
  requestDeletion: (password?: string) => rpc<{ purgeAt: string }>('requestMyAccountDeletion', { password }),
  restore: () => rpc('restoreMyAccount'),
  blocked: () => rpc<BlockedUser[]>('listBlockedUsers'),
  block: (userId: string) => rpc('blockUser', { userId }),
  unblock: (userId: string) => rpc('unblockUser', { userId }),
  reviewEligibility: (sellerId: string, listingId?: string) =>
    rpc<{ eligible: boolean; reason: string | null; existing: { rating: number; comment: string | null } | null }>(
      'checkReviewEligibility',
      { sellerId, listingId },
    ),
  leaveReview: (data: { sellerId: string; listingId?: string; rating: number; comment?: string }) => rpc('leaveReview', data),
};

// ─── Follows & Store Applications ───────────────────────────────────────────

export const follows = {
  status: (sellerId: string) => rpc<FollowStatus>('getFollowStatus', { sellerId }),
  follow: (sellerId: string) => rpc<FollowStatus>('followSeller', { sellerId }),
  unfollow: (sellerId: string) => rpc<FollowStatus>('unfollowSeller', { sellerId }),
  mine: () => rpc<FollowedSellerSummary[]>('myFollowedSellers'),
};

export const storeApplications = {
  mine: () => rpc<StoreApplication | null>('myStoreApplication'),
  submit: (data: { name: string; city?: string; phone?: string; taxNo?: string; notes?: string }) =>
    rpc<StoreApplication>('submitStoreApplication', data),
};

// ─── Saved Searches ─────────────────────────────────────────────────────────

export const savedSearches = {
  list: () => rpc<SavedSearch[]>('listSavedSearches'),
  create: (data: {
    name: string;
    category_slug?: string | null;
    city?: string | null;
    district?: string | null;
    q?: string | null;
    min_price?: number | null;
    max_price?: number | null;
    filters?: SavedSearchFilters;
    notify?: boolean;
  }) => rpc<SavedSearch>('createSavedSearch', data),
  remove: (id: string) => rpc<{ ok: true }>('deleteSavedSearch', { id }),
  toggleNotify: (id: string, notify: boolean) => rpc<{ ok: true; notify: boolean }>('toggleSavedSearchNotify', { id, notify }),
};

// ─── Chat ───────────────────────────────────────────────────────────────────

export const chat = {
  inbox: () => rpc<Conversation[]>('listConversations'),
  thread: (conversationId: string) => rpc<Thread>('getThread', { conversationId }),
  older: (conversationId: string, before: string) =>
    rpc<{ messages: ChatMessage[]; hasMore: boolean }>('loadOlderMessages', { conversationId, before }),
  around: (conversationId: string, messageId: string) =>
    rpc<{ messages: ChatMessage[]; hasMoreBefore: boolean; hasMoreAfter: boolean }>('loadAroundMessage', { conversationId, messageId }),
  poll: (conversationId: string, after: string) =>
    rpc<{ messages: ChatMessage[]; reads: { id: string; read_at: string }[]; other_online: boolean; other_last_seen: string | null }>(
      'pollThread',
      { conversationId, after },
    ),
  markRead: (conversationId: string) => rpc('markThreadRead', { conversationId }),
  typing: (conversationId: string) => rpc('sendTyping', { conversationId }),
  /** Opens (or reuses) the chat for a listing with a first message, an opening offer, or both. */
  start: (listingId: string, first: { content?: string; offer?: number }) =>
    rpc<{ conversationId: string }>('startConversation', { listingId, ...first }),
  /** `clientId`: the same id on a retry, so a message that already went out is not sent twice. */
  send: (conversationId: string, content: string, replyTo?: string, clientId?: string) =>
    rpc<ChatMessage>('sendMessage', { conversationId, content, replyTo, clientId }),
  sendLocation: (conversationId: string, label: string, lat?: number, lng?: number) =>
    rpc<ChatMessage>('sendLocation', { conversationId, label, lat, lng }),
  offer: (conversationId: string, amount: number, counterTo?: string) =>
    rpc<ChatMessage>('sendOffer', { conversationId, amount, counterTo }),
  respondOffer: (messageId: string, accept: boolean) => rpc<ChatMessage>('respondOffer', { messageId, accept }),
  deleteMessage: (messageId: string) => rpc<ChatMessage>('deleteMessage', { messageId }),
  archive: (conversationId: string, archived: boolean) => rpc('archiveConversation', { conversationId, archived }),
  markUnread: (conversationId: string, unread: boolean) => rpc('markConversationUnread', { conversationId, unread }),
  remove: (conversationId: string) => rpc('deleteConversation', { conversationId }),
  report: (conversationId: string, reason: string, details?: string, messageId?: string) =>
    rpc('reportConversation', { conversationId, reason, details, messageId }),
  search: (conversationId: string, q: string) =>
    rpc<{ id: string; sender_id: string; content: string; created_at: string }[]>('searchMessages', { conversationId, q }),
  templates: () => rpc<string[]>('getChatTemplates'),
  saveTemplates: (templates: string[]) => rpc<string[]>('saveChatTemplates', { templates }),
};

// ─── Places (meeting-point picker; the site proxies OpenStreetMap Nominatim) ──

export type GeoPlace = { label: string; lat: number; lng: number };

export const geo = {
  search: (q: string, near?: { lat: number; lng: number }) =>
    request<{ results: GeoPlace[] }>(`/api/geo${toQuery({ q, near: near ? `${near.lat},${near.lng}` : undefined })}`, { auth: false }).then(
      (r) => r.results,
    ),
  reverse: (lat: number, lng: number) =>
    request<{ label: string }>(`/api/geo${toQuery({ lat: lat.toFixed(6), lng: lng.toFixed(6) })}`, { auth: false }).then((r) => r.label),
};

// ─── Uploads ────────────────────────────────────────────────────────────────

async function imageForm(image: LocalImage, extra: Record<string, string> = {}, signal?: AbortSignal): Promise<FormData> {
  return buildImageForm(image, { extra, isWeb: Platform.OS === 'web', signal });
}

const uploadHeaders = { [UPLOAD_HEADER]: '1' };

export const uploads = {
  /** Listing photo (the site converts and resizes it); returns its "/uploads/…" path. */
  listingPhoto: async (image: LocalImage, signal?: AbortSignal) => {
    const form = await imageForm(image, {}, signal);
    const r = await request<{ url: string }>('/api/upload', { method: 'POST', form, headers: uploadHeaders, timeoutMs: 90_000, signal });
    return r.url;
  },
  discardListingPhoto: (url: string) =>
    request('/api/upload', { method: 'DELETE', body: { url }, headers: uploadHeaders }).catch(() => undefined),
  chatPhoto: async (conversationId: string, image: LocalImage) => {
    const form = await imageForm(image, { conversationId });
    const r = await request<{ message: ChatMessage }>('/api/chat/image', {
      method: 'POST',
      form,
      headers: uploadHeaders,
      timeoutMs: 90_000,
    });
    return r.message;
  },
  avatar: async (image: LocalImage) => {
    const form = await imageForm(image);
    const r = await request<{ url: string }>('/api/avatar', { method: 'POST', form, headers: uploadHeaders, timeoutMs: 60_000 });
    return r.url;
  },
  removeAvatar: () => request('/api/avatar', { method: 'DELETE', headers: uploadHeaders }),
  storeLogo: async (image: LocalImage) => {
    const form = await imageForm(image);
    const r = await request<{ url: string }>('/api/store-logo', { method: 'POST', form, headers: uploadHeaders, timeoutMs: 60_000 });
    return r.url;
  },
  removeStoreLogo: () => request<{ ok: boolean }>('/api/store-logo', { method: 'DELETE', headers: uploadHeaders }),
};
