import { createFileRoute } from "@tanstack/react-router";
import { UnauthorizedError } from "@/lib/auth/verify.server";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";
import { rateLimit, viewerKey } from "@/lib/server/helpers";
import { assertMobileJsonWrite } from "@/lib/server/mobile-auth";
import { BodyTooLargeError, readLimited } from "@/lib/server/request-body";
import {
  archiveConversation,
  deleteConversation,
  deleteMessage,
  editMessage,
  getChatTemplates,
  getThread,
  listBlockedUsers,
  listConversations,
  loadAroundMessage,
  loadOlderMessages,
  markConversationUnread,
  markThreadRead,
  muteConversation,
  pinConversation,
  pollThread,
  reportConversation,
  respondOffer,
  saveChatTemplates,
  searchMessages,
  sendLocation,
  sendMessage,
  sendOffer,
  sendTyping,
  startConversation,
} from "@/lib/server/chat";
import {
  getAccountSettings,
  getDeletionStatus,
  requestMyAccountDeletion,
  restoreMyAccount,
  updateMessageEmail,
  updateNotifyPrefs,
  updatePrivacySettings,
} from "@/lib/server/settings";
import {
  bulkImportListings,
  getListingForEdit,
  getMe,
  myCreditOrders,
  myStoreApplication,
  quickUpdatePrice,
  submitStoreApplication,
  updateProfile,
  upsertStore,
} from "@/lib/server/account";
import { followSeller, getFollowStatus, myFollowedSellers, unfollowSeller } from "@/lib/server/follows";
import { blockUser, checkReviewEligibility, leaveReview, myRecentListings, removeRecentListing, unblockUser, unreadCount } from "@/lib/server/social";
import {
  autocompleteSuggestions,
  browseCategories,
  getCategory,
  getCategoryPriceStats,
  getLegal,
  getListingsByIds,
  getSiteSettings,
  homeListings,
  listCategoryRoots,
  mapCityCounts,
  mapListingsInBounds,
  searchCatalogWithContext,
  searchCategoryPaths,
  statsHome,
} from "@/lib/server/catalog";
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  toggleSavedSearchNotify,
} from "@/lib/server/saved-searches";

type ServerFn = (opts: { data?: unknown }) => Promise<unknown>;

/**
 * Server functions the native app may call by name. Each one keeps its own
 * validator and auth middleware; the Better Auth bearer plugin turns the app's
 * `Authorization: Bearer …` header into the session those middlewares read.
 */
const FUNCTIONS: Record<string, ServerFn> = {
  // Catalog (public)
  autocompleteSuggestions,
  browseCategories,
  getCategory,
  getCategoryPriceStats,
  getLegal,
  getListingsByIds,
  getSiteSettings,
  homeListings,
  listCategoryRoots,
  mapCityCounts,
  mapListingsInBounds,
  searchCatalogWithContext,
  searchCategoryPaths,
  statsHome,
  // Account
  bulkImportListings,
  followSeller,
  getFollowStatus,
  getMe,
  myFollowedSellers,
  myStoreApplication,
  quickUpdatePrice,
  submitStoreApplication,
  unfollowSeller,
  updateProfile,
  upsertStore,
  getListingForEdit,
  myCreditOrders,
  unreadCount,
  blockUser,
  unblockUser,
  checkReviewEligibility,
  leaveReview,
  myRecentListings,
  removeRecentListing,
  listSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  toggleSavedSearchNotify,
  // Settings
  getAccountSettings,
  updatePrivacySettings,
  updateMessageEmail,
  updateNotifyPrefs,
  getDeletionStatus,
  requestMyAccountDeletion,
  restoreMyAccount,
  // Chat
  listConversations,
  getThread,
  loadOlderMessages,
  loadAroundMessage,
  pollThread,
  markThreadRead,
  sendTyping,
  startConversation,
  sendMessage,
  sendLocation,
  sendOffer,
  respondOffer,
  deleteMessage,
  editMessage,
  archiveConversation,
  markConversationUnread,
  muteConversation,
  pinConversation,
  deleteConversation,
  reportConversation,
  searchMessages,
  getChatTemplates,
  saveChatTemplates,
  listBlockedUsers,
} as unknown as Record<string, ServerFn>;

/** Largest accepted RPC body; photos go through their own upload routes. */
const MAX_BODY_BYTES = 1024 * 1024;

export const Route = createFileRoute("/api/mobile/rpc/$fn")({
  server: {
    handlers: {
      /** Body: `{ "data": … }` (omit for functions without input). Replies `{ success, result }` or `{ success: false, error }`. */
      POST: async ({ request, params }) => {
        const csrfError = assertMobileJsonWrite(request);
        if (csrfError) return csrfError;
        try {
          rateLimit(`mobile-rpc:${viewerKey(request.headers)}`, 180, 60_000);
        } catch (error) {
          return Response.json({ success: false, error: publicErrorMessage(error, "Çok fazla istek.") }, { status: errorStatus(error, 429) });
        }
        const fn = Object.hasOwn(FUNCTIONS, params.fn) ? FUNCTIONS[params.fn] : undefined;
        if (!fn) return Response.json({ success: false, error: "İşlem bulunamadı." }, { status: 404 });
        let body: { data?: unknown } = {};
        try {
          const text = new TextDecoder().decode(await readLimited(request, MAX_BODY_BYTES));
          if (text.trim()) {
            const parsed: unknown = JSON.parse(text);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              return Response.json({ success: false, error: "Geçersiz istek gövdesi." }, { status: 400 });
            }
            body = parsed as { data?: unknown };
          }
        } catch (error) {
          return Response.json({ success: false, error: error instanceof BodyTooLargeError ? error.message : "İstek okunamadı." }, { status: errorStatus(error, 400) });
        }
        try {
          const result = await fn(body.data === undefined ? {} : { data: body.data });
          return Response.json({ success: true, result: result ?? null }, { headers: { "Cache-Control": "private, no-store" } });
        } catch (error) {
          if (error instanceof Response) {
            return error;
          }
          if (error instanceof UnauthorizedError) {
            return Response.json({ success: false, error: "Giriş yapmanız gerekiyor." }, { status: 401 });
          }
          return Response.json({ success: false, error: validationMessage(error) ?? publicErrorMessage(error, "İşlem tamamlanamadı.") }, { status: errorStatus(error, 400) });
        }
      },
    },
  },
});

/** First message of a zod validation error, which otherwise arrives as a JSON string. */
function validationMessage(error: unknown): string | null {
  if (!(error instanceof Error) || !error.message.startsWith("[")) return null;
  try {
    const issues = JSON.parse(error.message) as Array<{ message?: string }>;
    return issues[0]?.message ? String(issues[0].message) : "Bilgileri kontrol edin.";
  } catch {
    return null;
  }
}
