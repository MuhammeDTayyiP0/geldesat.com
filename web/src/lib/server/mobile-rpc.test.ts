import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Whatever is in this list can be called by name from outside with any member's
 * token, so adding a function should be a decision. Admin functions never belong.
 */
const ALLOWED = [
  "archiveConversation", "blockUser", "browseCategories", "checkReviewEligibility", "deleteConversation",
  "deleteMessage", "getAccountSettings", "getCategory", "getChatTemplates", "getDeletionStatus", "getLegal",
  "getListingForEdit", "getMe", "getSiteSettings", "getThread", "leaveReview", "listBlockedUsers",
  "listCategoryRoots", "listConversations", "loadAroundMessage", "loadOlderMessages", "markConversationUnread",
  "markThreadRead", "myCreditOrders", "myRecentListings", "pollThread", "removeRecentListing", "reportConversation",
  "requestMyAccountDeletion", "respondOffer", "restoreMyAccount", "saveChatTemplates", "searchCatalogWithContext",
  "searchMessages", "sendLocation", "sendMessage", "sendOffer", "sendTyping", "startConversation", "statsHome",
  "unblockUser", "unreadCount", "updateMessageEmail", "updateNotifyPrefs", "updatePrivacySettings", "updateProfile",
  "upsertStore",
];

test("the app can only call the functions on this list", async () => {
  const source = await readFile(join(process.cwd(), "src/routes/api/mobile/rpc/$fn.ts"), "utf8");
  const start = source.indexOf("const FUNCTIONS");
  assert.ok(start > 0, "FUNCTIONS not found");
  const block = source.slice(start, source.indexOf("} as unknown as", start));
  const names = [...block.matchAll(/^\s+(\w+),\s*$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(names, [...ALLOWED].sort());
  assert.doesNotMatch(source, /server\/admin/);
});
