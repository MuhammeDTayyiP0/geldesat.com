# Graph Report - geldesat.com  (2026-11-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3044 nodes · 11717 edges · 106 communities (83 shown, 23 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 149 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b4372f3b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- routeTree.gen.ts
- helpers.ts
- utils.ts
- react-native
- ilanlar.tsx
- search.tsx
- ilan/[id].tsx
- app/ilan-ver.tsx
- content.ts
- mobile-app/package.json
- useTheme
- lucide-react
- chat.ts
- mesaj/[id].tsx
- UserSheet.tsx
- queries.ts
- endpoints.ts
- getSql
- routes/ilan-ver.tsx
- CategoryPanel.tsx
- generate-catalog.mjs
- ref_react
- Button
- errorText
- Navbar.tsx
- account.ts
- dependencies
- environment
- expo
- cn
- ui.tsx
- db.ts
- ota-publish.mjs
- web/package.json
- PhotoUploader.tsx
- catalog.ts
- with
- auth.ts
- server/ota.ts
- mesajlar/$id.tsx
- devDependencies
- server/config.ts
- routes/index.tsx
- routes/mesajlar.tsx
- image-pipeline.server.ts
- DialogContent
- upload.server.ts
- app/_layout.tsx
- settings.ts
- app/ayarlar/guvenlik.tsx
- retention.ts
- MapCanvas.tsx
- components/chat/LocationPicker.tsx
- mobile-oauth.ts
- components.json
- compilerOptions
- LazyPGliteDriver
- devDependencies
- themePref.ts
- ref_node_assert
- Thread
- middleware/seo.ts
- features/chat/stream.ts
- router.tsx
- errorReport.ts
- vite.config.ts
- listing/CategoryPicker.tsx
- data/geo.ts
- mail.ts
- storage.ts
- lib/ota.ts
- scripts
- chat-stream.ts
- api/geo.ts
- metro.config.js
- mobile-app/tsconfig.json
- $hash.ts
- app-links.ts
- popover.tsx
- AutocompleteSearchBar
- $y.ts
- security-headers.ts
- admin.tsx
- blocks.ts
- conversations.ts
- conversations/$id.ts
- mobile/images.ts
- profile.ts
- routes/doping.tsx
- mesajlar/index.tsx
- better-auth
- clsx
- @fontsource-variable/ibm-plex-sans
- lightningcss
- postcss
- @radix-ui/react-alert-dialog
- @radix-ui/react-radio-group
- @radix-ui/react-toggle
- @radix-ui/react-toggle-group
- @radix-ui/react-tooltip
- recharts
- sharp
- tailwind-merge
- cron.mjs
- heic-decode.d.ts

## God Nodes (most connected - your core abstractions)
1. `getSql()` - 214 edges
2. `cn()` - 213 edges
3. `useTheme()` - 143 edges
4. `Text()` - 134 edges
5. `Button()` - 124 edges
6. `@tanstack/react-router` - 117 edges
7. `errorText()` - 83 edges
8. `lucide-react` - 81 edges
9. `Button()` - 77 edges
10. `react-native` - 73 edges

## Surprising Connections (you probably didn't know these)
- `rememberConfig()` --indirect_call--> `cached()`  [INFERRED]
  mobile-app/src/lib/configCache.ts → web/src/lib/server/catalog.ts
- `hasGlobbedMigrations()` --indirect_call--> `isMigrationFile()`  [INFERRED]
  web/vite.config.ts → web/scripts/migration-plan.mjs
- `FileRoutesById` --references--> `Route`  [EXTRACTED]
  web/src/routeTree.gen.ts → web/src/routes/__root.tsx
- `searchListings()` --indirect_call--> `mapListing()`  [INFERRED]
  web/src/lib/server/catalog.ts → web/src/lib/server/helpers.ts
- `requestCreditOrder` --calls--> `rateLimit()`  [EXTRACTED]
  web/src/lib/server/account.ts → web/src/lib/server/helpers.ts

## Import Cycles
- None detected.

## Communities (106 total, 23 thin omitted)

### Community 0 - "routeTree.gen.ts"
Cohesion: 0.01
Nodes (141): Route, Route, Route, Route, Route, Route, Route, Route (+133 more)

### Community 1 - "helpers.ts"
Cohesion: 0.07
Nodes (71): auth, myListings, revealPhone, browseCategories, getCategory, getListing, incrementView, categoryPath() (+63 more)

### Community 2 - "utils.ts"
Cohesion: 0.07
Nodes (73): AttrValue(), Breadcrumbs(), Crumb, DescriptionSection(), FACTS, KeyFacts(), LocationSection(), PriceHistorySection() (+65 more)

### Community 3 - "react-native"
Cohesion: 0.05
Nodes (67): useCounts(), GoogleMark(), Mode, SignInScreen(), styles, styles, TabBar(), TABS (+59 more)

### Community 4 - "ilanlar.tsx"
Cohesion: 0.09
Nodes (74): ATTRIBUTE_TYPE_LABEL, dateOnly(), useSheets(), int(), oneOf(), str(), Avatar(), BulkBar() (+66 more)

### Community 5 - "search.tsx"
Cohesion: 0.06
Nodes (61): Block, LegalBlocks, withMailLinks(), NotFound(), FilterState, buildPageRange(), Pagination(), attrsToSearch() (+53 more)

### Community 6 - "ilan/[id].tsx"
Cohesion: 0.06
Nodes (63): myListings, queryClient, OwnerAction, attrText(), DetailSkeleton(), InfoRow(), ListingScreen(), Meta() (+55 more)

### Community 7 - "app/ilan-ver.tsx"
Cohesion: 0.07
Nodes (61): account, uploads, useMe(), AttrDef, StoreSettings(), StoreSettingsScreen(), styles, ProfileSettings() (+53 more)

### Community 8 - "content.ts"
Cohesion: 0.10
Nodes (61): @tanstack/react-start, zod, DbSource, dbSource, VERSION_PATTERN, liveSql(), adminCreditLedger, adminListCreditOrders (+53 more)

### Community 9 - "mobile-app/package.json"
Cohesion: 0.04
Nodes (66): dependencies, expo-clipboard@~58.0.3, expo-constants@~58.0.12, expo-crypto@~58.0.7, expo-dev-client@~58.0.14, expo-device@~58.0.5, expo-font@~58.0.9, expo-haptics@~58.0.7 (+58 more)

### Community 10 - "useTheme"
Cohesion: 0.13
Nodes (56): NotificationSettings(), NotificationSettingsScreen(), BlockedUsersScreen(), BlockedUsersScreenScreen(), styles, PHONE_OPTIONS, PrivacySettings(), PrivacySettingsScreen() (+48 more)

### Community 11 - "lucide-react"
Cohesion: 0.11
Nodes (49): lucide-react, sonner, ACCOUNT_ITEMS, AccountNavItem, NavTo, SETTINGS_ITEMS, SETTINGS_SECTIONS, useAccountMeta() (+41 more)

### Community 12 - "chat.ts"
Cohesion: 0.10
Nodes (60): myCreditOrders, getLegal, archiveConversation, assertCanMessage(), blockedBetween(), broadcastChatMessage(), broadcastChatRead(), broadcastChatUpdate() (+52 more)

### Community 13 - "mesaj/[id].tsx"
Cohesion: 0.08
Nodes (59): errorMessage(), chat, DeleteAccountSheet(), ChatScreen(), localDay(), mergeMessages(), newClientId(), OfferComposer() (+51 more)

### Community 14 - "UserSheet.tsx"
Cohesion: 0.10
Nodes (55): AuditList(), DOT, actionTone(), age(), compact, dateTime(), delta(), errorMessage() (+47 more)

### Community 15 - "queries.ts"
Cohesion: 0.08
Nodes (50): catalog, listings, keys, PUBLIC_QUERIES, useConfig(), useRoots(), SortKey, AppearanceScreen() (+42 more)

### Community 16 - "endpoints.ts"
Cohesion: 0.06
Nodes (53): NETWORK_ERROR, RequestOptions, rpc(), toQuery(), UPLOAD_HEADER, geo, GeoPlace, LocalImage (+45 more)

### Community 17 - "getSql"
Cohesion: 0.09
Nodes (52): getSql(), deleteListing, setListingStatus, adminAttributeUsage, adminDeleteAttribute, adminSaveAttribute, SaveInput, adminDeleteStore (+44 more)

### Community 18 - "routes/ilan-ver.tsx"
Cohesion: 0.09
Nodes (44): Filters(), Input(), Label(), Select(), Textarea(), PhoneInput, PhoneInputProps, TURKEY_CITIES (+36 more)

### Community 19 - "CategoryPanel.tsx"
Cohesion: 0.07
Nodes (51): AttributesTab(), CategoryPanel(), ChildrenTab(), move(), InfoTab(), OwnItem, Tab, CategoryTree (+43 more)

### Community 20 - "generate-catalog.mjs"
Cohesion: 0.05
Nodes (47): addCat(), addChildren(), addModelTree(), attrs, brandId(), brands(), bslug(), cats (+39 more)

### Community 21 - "ref_react"
Cohesion: 0.07
Nodes (35): @tanstack/react-router, NotFoundProps, POPULAR_CATEGORIES, CookieBanner(), cols, Footer(), TopProgressBar(), Checkbox (+27 more)

### Community 22 - "Button"
Cohesion: 0.11
Nodes (44): ManageTab(), bytes(), n(), Card(), CardHead(), FieldGroup(), inputClass, StatCard() (+36 more)

### Community 23 - "errorText"
Cohesion: 0.09
Nodes (41): DeletionBanner(), restore(), authClient, googleAuthEnabled, AuthError, authErrorText(), authRedirectErrorText(), BY_CODE (+33 more)

### Community 24 - "Navbar.tsx"
Cohesion: 0.08
Nodes (28): LogoMark(), LogoMarkProps, BottomNav(), AllCategoriesMegaMenu, loadMegaMenu(), MegaMenuOverlay, MobileNavigationDrawer(), MAIN_NAV_CATEGORIES (+20 more)

### Community 25 - "account.ts"
Cohesion: 0.08
Nodes (39): CITY_COORDS, AttrRule, AttrValues, cleanAttrs(), MIN_YEAR, now, rules, YEAR_NAMES (+31 more)

### Community 26 - "dependencies"
Cohesion: 0.04
Nodes (46): class-variance-authority, heic-decode, @hookform/resolvers, jose, nodemailer, @radix-ui/react-accordion, @radix-ui/react-collapsible, @radix-ui/react-dialog (+38 more)

### Community 27 - "environment"
Cohesion: 0.04
Nodes (45): VITE_GOOGLE_AUTH_ENABLED, args, context, condition, environment, healthcheck, image, restart (+37 more)

### Community 28 - "expo"
Cohesion: 0.04
Nodes (44): backgroundColor, foregroundImage, monochromeImage, adaptiveIcon, blockedPermissions, intentFilters, package, permissions (+36 more)

### Community 29 - "cn"
Cohesion: 0.08
Nodes (37): AccordionContent, AccordionItem, AccordionTrigger, Alert(), AlertDescription(), AlertTitle(), alertVariants, AlertDialogAction (+29 more)

### Community 30 - "ui.tsx"
Cohesion: 0.09
Nodes (32): AdminShell(), Chrome(), SheetHost(), CategoryPickerDialog(), CommandPalette(), LISTING_STATUS, ActionKind, buildCategoryIndex() (+24 more)

### Community 31 - "db.ts"
Cohesion: 0.07
Nodes (30): @electric-sql/pglite, pg, authSecret(), databaseUrl, env(), explicitBaseURL, globalAuthRef, googleAuthConfigured (+22 more)

### Community 32 - "ota-publish.mjs"
Cohesion: 0.09
Nodes (27): api(), checkNative(), CONTENT_TYPES, describe(), fail(), FINGERPRINT_FILE, main(), nativeFingerprint() (+19 more)

### Community 33 - "web/package.json"
Cohesion: 0.05
Nodes (36): cmdk, date-fns, @radix-ui/react-avatar, @radix-ui/react-checkbox, @radix-ui/react-progress, @radix-ui/react-slider, @radix-ui/react-tabs, react-hook-form (+28 more)

### Community 34 - "PhotoUploader.tsx"
Cohesion: 0.11
Nodes (29): Drag, MAX_PHOTOS, Pending, PhotoOriginal, PhotoUploader(), addFiles(), endDrag(), move() (+21 more)

### Community 35 - "catalog.ts"
Cohesion: 0.09
Nodes (31): foldTr(), getSubtree, adminGetSettings, adminSaveSiteSettings, ibanChecks(), cached(), clearSiteSettingsCache(), escapeLike() (+23 more)

### Community 36 - "with"
Cohesion: 0.06
Nodes (32): runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, defaults, run (+24 more)

### Community 37 - "auth.ts"
Cohesion: 0.15
Nodes (31): ApiError, fallbackMessage(), request(), timedFetch(), AuthBody, authPost(), base64Url(), changePassword() (+23 more)

### Community 38 - "server/ota.ts"
Cohesion: 0.14
Nodes (26): assetUrl(), buildManifest(), CHANNEL_PATTERN, Directive, HASH_PATTERN, iso(), multipartResponse(), OtaAsset (+18 more)

### Community 39 - "mesajlar/$id.tsx"
Cohesion: 0.12
Nodes (26): MapThumb(), clock(), MessageBubble(), OFFER_STATE, useSwipeToReply(), DropdownMenu(), DropdownMenuTrigger(), BUYER_QUICK_REPLIES (+18 more)

### Community 40 - "devDependencies"
Cohesion: 0.08
Nodes (29): eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, jiti, prettier (+21 more)

### Community 41 - "server/config.ts"
Cohesion: 0.12
Nodes (25): CODE_FLAGS, compareVersions(), evaluateFlags(), FLAG_NAME_PATTERN, FLAG_PLATFORMS, flagBucket(), FlagContext, FlagPlatform (+17 more)

### Community 42 - "routes/index.tsx"
Cohesion: 0.14
Nodes (21): BY_KEY, CATEGORY_ICONS, categoryVisual(), ListingRail(), ListingDetailSkeleton(), CardGridSkeleton(), ListingGridSkeleton(), ProfilePageSkeleton() (+13 more)

### Community 43 - "routes/mesajlar.tsx"
Cohesion: 0.11
Nodes (21): ChatAvatar(), MenuContent(), MenuItem(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem() (+13 more)

### Community 44 - "image-pipeline.server.ts"
Cohesion: 0.14
Nodes (22): chatWatermarkSvg(), cornerBadge(), HEIF_BRANDS, isHeif(), listingWatermarkSvg(), MARK_PATHS, markUnit(), openHeif() (+14 more)

### Community 45 - "DialogContent"
Cohesion: 0.20
Nodes (22): ConfirmDialog(), LocationPicker(), send(), RotateDialog(), Dialog(), DialogContent(), DialogDescription(), DialogFooter() (+14 more)

### Community 46 - "upload.server.ts"
Cohesion: 0.20
Nodes (18): BadRequestError, BodyTooLargeError, limitedFormData(), readLimited(), authorizeUpload(), json(), assertImageBytes(), assertSize() (+10 more)

### Community 47 - "app/_layout.tsx"
Cohesion: 0.16
Nodes (20): clearPrivateQueries(), AppBadge(), RootLayout(), SessionEffects(), styles, UpdateGate(), onStreamResume(), resetChatStream() (+12 more)

### Community 48 - "settings.ts"
Cohesion: 0.11
Nodes (18): authMiddleware, getSessionUser(), requireUserId(), UnauthorizedError, VerifiedUser, NOTIFY_TYPES, NotifyChannelPrefs, NotifyPrefs (+10 more)

### Community 49 - "app/ayarlar/guvenlik.tsx"
Cohesion: 0.17
Nodes (18): styles, UpdateScreen(), when(), SecuritySettings(), SecuritySettingsScreen(), styles, CORPORATE, LEGAL (+10 more)

### Community 50 - "retention.ts"
Cohesion: 0.17
Nodes (17): Sql, ACCOUNT_GRACE_DAYS, CHAT_RETENTION_DAYS, purgeUserData(), unreadMessageCount(), setAppConfig(), mailConfigured, PENDING() (+9 more)

### Community 51 - "MapCanvas.tsx"
Cohesion: 0.16
Nodes (17): MapCanvas, MapCanvasHandle, Props, MapCanvas, MapCanvasHandle, Props, WebView, WebViewHandle (+9 more)

### Community 52 - "components/chat/LocationPicker.tsx"
Cohesion: 0.19
Nodes (13): leaflet, leaflet@^1.9.4, Place, CityMap(), previewTiles(), TILE_ATTRIBUTION, TILE_URL, tilePoint() (+5 more)

### Community 53 - "mobile-oauth.ts"
Cohesion: 0.22
Nodes (14): challengeCookie(), globalRef, isChallenge(), MOBILE_OAUTH_REDIRECT, parkToken(), Pending, prune(), readChallengeCookie() (+6 more)

### Community 54 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 55 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, checkJs, isolatedModules, jsx, lib (+10 more)

### Community 56 - "LazyPGliteDriver"
Cohesion: 0.12
Nodes (6): kysely, kysely@^0.28.5, Client, LazyPGliteDriver, PGliteConnection, pgliteDialect()

### Community 57 - "devDependencies"
Cohesion: 0.12
Nodes (14): { defineConfig }, expoConfig, devDependencies, eslint@^9.39.5, eslint-config-expo@~58.0.4, @types/react@~19.3.0, typescript@~6.0.3, eslint-config-expo (+6 more)

### Community 58 - "themePref.ts"
Cohesion: 0.17
Nodes (14): expo-location@~58.0.18, @react-native-async-storage/async-storage@2.2.0, fold(), listeners, matchCity(), setCity(), useNearbyCity(), apply() (+6 more)

### Community 59 - "ref_node_assert"
Cohesion: 0.20
Nodes (5): resolveSignInGateState(), SignInGateInput, SignInGateState, dir, ALLOWED

### Community 60 - "Thread"
Cohesion: 0.19
Nodes (14): uploadChatPhoto(), pingInbox(), dayLabel(), Thread, backToLatest(), jumpTo(), loadOlder(), onScroll() (+6 more)

### Community 61 - "middleware/seo.ts"
Cohesion: 0.35
Nodes (13): buildCategoriesSitemap(), buildListingsSitemap(), buildRobots(), buildSellersSitemap(), buildSitemapIndex(), buildStaticSitemap(), buildStoresSitemap(), SeoEvent (+5 more)

### Community 62 - "features/chat/stream.ts"
Cohesion: 0.24
Nodes (12): ChatStreamEvent, close(), dispatch(), feedWatchdog(), Listener, listeners, notifyReconnect(), openThreads (+4 more)

### Community 63 - "router.tsx"
Cohesion: 0.26
Nodes (9): criticalAssetsLinkHeader, criticalFonts, buildCsp(), createNonce(), AppErrorComponent(), getRouter(), GlobalPending(), pageNonce (+1 more)

### Community 64 - "errorReport.ts"
Cohesion: 0.32
Nodes (11): enabled(), ErrorUtilsShape, flushErrorReports(), GlobalHandler, installGlobalErrorHandler(), readPending(), Report, reportError() (+3 more)

### Community 65 - "vite.config.ts"
Cohesion: 0.17
Nodes (9): nitro, @tailwindcss/vite, vite, @vitejs/plugin-react, nitro@3.0.260610-beta, @tailwindcss/vite@^4.3.0, vite@^8.2.0, @vitejs/plugin-react@^5.2.0 (+1 more)

### Community 66 - "listing/CategoryPicker.tsx"
Cohesion: 0.26
Nodes (10): CategoryButtons(), CategoryDirectory(), meta(), row(), DirectoryProps, firstLetter(), POPULAR_NAMES, sortedCats() (+2 more)

### Community 67 - "data/geo.ts"
Cohesion: 0.23
Nodes (10): BOOST_PACKAGES, CREDIT_SKUS, NEIGHBORHOODS, REPORT_REASONS, listeners, nearestCity(), read(), subscribe() (+2 more)

### Community 68 - "mail.ts"
Cohesion: 0.47
Nodes (11): DigestItem, env(), escapeHtml(), getTransporter(), hello(), layout(), send(), sendEmailChangeMail() (+3 more)

### Community 69 - "storage.ts"
Cohesion: 0.27
Nodes (9): clearSearches(), forgetSearch(), listeners, loadDraft(), notify(), StoredDraft, useRecentSearches(), useStoredList() (+1 more)

### Community 70 - "lib/ota.ts"
Cohesion: 0.31
Nodes (9): expo-updates@~58.0.17, checkAndDownload(), checkNow(), GeldesatExtra, geldesatExtra(), isCritical(), updateMessage(), useOtaUpdates() (+1 more)

### Community 71 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:migrate, dev, format, lint, start, start:prod (+2 more)

### Community 72 - "chat-stream.ts"
Cohesion: 0.31
Nodes (9): ChatStreamEvent, emit(), isHidden(), Listener, listeners, onVisibility(), openThreads, sync() (+1 more)

### Community 73 - "api/geo.ts"
Cohesion: 0.29
Nodes (9): Cached, globalRef, inFlight, json(), nextNominatimSlot(), nominatim(), NominatimPlace, Route (+1 more)

### Community 74 - "metro.config.js"
Cohesion: 0.25
Nodes (5): config, { getDefaultConfig }, https, expo@~58.0.16, expo

### Community 75 - "mobile-app/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noUnusedLocals, paths, strict, extends, include, expo/tsconfig.base

### Community 76 - "$hash.ts"
Cohesion: 0.32
Nodes (5): cache, Cached, gzipAsync, remember(), Route

### Community 77 - "app-links.ts"
Cohesion: 0.25
Nodes (4): ANDROID_SHA256_FINGERPRINTS, APP_PATHS, AppLinksEvent, FILES

### Community 78 - "popover.tsx"
Cohesion: 0.29
Nodes (3): @radix-ui/react-popover, @radix-ui/react-popover@^1.1.15, PopoverContent()

### Community 79 - "AutocompleteSearchBar"
Cohesion: 0.38
Nodes (4): AutocompleteSearchBar(), executeSearch(), handleFormSubmit(), saveSearchTerm()

### Community 80 - "$y.ts"
Cohesion: 0.38
Nodes (6): Cached, fetchTile(), globalRef, inFlight, Route, tileResponse()

### Community 81 - "security-headers.ts"
Cohesion: 0.50
Nodes (4): BASE_HEADERS, HeaderEvent, securityHeaders(), securityHeadersMiddleware()

### Community 82 - "admin.tsx"
Cohesion: 0.67
Nodes (3): isAdminSession, AdminLayout(), Route

## Knowledge Gaps
- **1 isolated node(s):** `expo/tsconfig.base`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 841 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@tanstack/react-router` connect `ref_react` to `routeTree.gen.ts`, `helpers.ts`, `utils.ts`, `ilanlar.tsx`, `search.tsx`, `lucide-react`, `chat.ts`, `UserSheet.tsx`, `getSql`, `routes/ilan-ver.tsx`, `CategoryPanel.tsx`, `Button`, `errorText`, `Navbar.tsx`, `account.ts`, `dependencies`, `ui.tsx`, `web/package.json`, `catalog.ts`, `server/ota.ts`, `mesajlar/$id.tsx`, `routes/index.tsx`, `routes/mesajlar.tsx`, `image-pipeline.server.ts`, `upload.server.ts`, `settings.ts`, `retention.ts`, `components/chat/LocationPicker.tsx`, `mobile-oauth.ts`, `router.tsx`, `listing/CategoryPicker.tsx`, `api/geo.ts`, `$hash.ts`, `$y.ts`, `admin.tsx`, `blocks.ts`, `conversations.ts`, `conversations/$id.ts`, `mobile/images.ts`, `profile.ts`, `routes/doping.tsx`, `mesajlar/index.tsx`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.014084507042253521 - nodes in this community are weakly interconnected._
- **Why does `getSql()` connect `getSql` to `helpers.ts`, `utils.ts`, `ilanlar.tsx`, `content.ts`, `lucide-react`, `chat.ts`, `routes/ilan-ver.tsx`, `CategoryPanel.tsx`, `Button`, `errorText`, `account.ts`, `ui.tsx`, `db.ts`, `catalog.ts`, `server/ota.ts`, `server/config.ts`, `routes/index.tsx`, `image-pipeline.server.ts`, `upload.server.ts`, `settings.ts`, `retention.ts`, `components/chat/LocationPicker.tsx`, `$hash.ts`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `helpers.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07059373539036932 - nodes in this community are weakly interconnected._
- **Why does `cn()` connect `cn` to `utils.ts`, `ilanlar.tsx`, `search.tsx`, `lucide-react`, `UserSheet.tsx`, `routes/ilan-ver.tsx`, `CategoryPanel.tsx`, `ref_react`, `Button`, `Navbar.tsx`, `ui.tsx`, `PhotoUploader.tsx`, `mesajlar/$id.tsx`, `routes/index.tsx`, `routes/mesajlar.tsx`, `DialogContent`, `components/chat/LocationPicker.tsx`, `Thread`, `popover.tsx`, `AutocompleteSearchBar`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06566347469220246 - nodes in this community are weakly interconnected._