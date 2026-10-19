import { Platform } from 'react-native';
import { request, rpc, toQuery, UPLOAD_HEADER } from './client';
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
  Listing,
  ListingDetail,
  ListingForEdit,
  ListingInput,
  Me,
  MobileConfig,
  NotifyPrefs,
  PhoneVisibility,
  SearchFilters,
  SearchResult,
  Seller,
  Store,
  Thread,
} from './types';

// ─── Catalog ────────────────────────────────────────────────────────────────

export const catalog = {
  config: (deviceId?: string) => request<MobileConfig>(`/api/mobile/config${toQuery({ deviceId })}`, { auth: false }),
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
  legal: (slug: string) => rpc<{ slug: string; title: string; body: string } | null>('getLegal', { slug }),
  siteSettings: () => rpc<{ support_email: string; support_phone: string; company_name: string }>('getSiteSettings'),
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
  seller: (id: string) => request<{ seller: Seller; listings: Listing[] }>(`/api/mobile/sellers/${encodeURIComponent(id)}`),
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
  unregisterPush: (token: string) =>
    request('/api/mobile/notifications', { method: 'POST', body: { action: 'unregister-push', token } }),
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
  start: (listingId: string, content: string) => rpc<{ conversationId: string }>('startConversation', { listingId, content }),
  send: (conversationId: string, content: string, replyTo?: string) =>
    rpc<ChatMessage>('sendMessage', { conversationId, content, replyTo }),
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

// ─── Uploads ────────────────────────────────────────────────────────────────

type LocalImage = { uri: string; mimeType?: string | null; fileName?: string | null };

function imageForm(image: LocalImage, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  const type = image.mimeType || 'image/jpeg';
  const ext = type.split('/')[1] ?? 'jpg';
  // React Native's FormData accepts { uri, name, type } for files.
  form.append('file', { uri: image.uri, name: image.fileName || `foto.${ext}`, type } as unknown as Blob);
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  return form;
}

const uploadHeaders = { [UPLOAD_HEADER]: '1' };

export const uploads = {
  /** Listing photo (the site converts and resizes it); returns its "/uploads/…" path. */
  listingPhoto: (image: LocalImage) =>
    request<{ url: string }>('/api/upload', { method: 'POST', form: imageForm(image), headers: uploadHeaders, timeoutMs: 90_000 }).then(
      (r) => r.url,
    ),
  discardListingPhoto: (url: string) =>
    request('/api/upload', { method: 'DELETE', body: { url }, headers: uploadHeaders }).catch(() => undefined),
  chatPhoto: (conversationId: string, image: LocalImage) =>
    request<{ message: ChatMessage }>('/api/chat/image', {
      method: 'POST',
      form: imageForm(image, { conversationId }),
      headers: uploadHeaders,
      timeoutMs: 90_000,
    }).then((r) => r.message),
  avatar: (image: LocalImage) =>
    request<{ url: string }>('/api/avatar', { method: 'POST', form: imageForm(image), headers: uploadHeaders, timeoutMs: 60_000 }).then(
      (r) => r.url,
    ),
  removeAvatar: () => request('/api/avatar', { method: 'DELETE', headers: uploadHeaders }),
};
