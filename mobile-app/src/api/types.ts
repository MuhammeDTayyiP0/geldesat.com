/** Shapes returned by the GeldeSat API (see web/src/routes/api/mobile and web/src/lib/server). */

/** Owner actions the server allows (web/src/lib/listing-status.ts). */
export type OwnerAction = 'edit' | 'publish' | 'hide' | 'sold' | 'renew' | 'delete';

export type Listing = {
  id: string;
  listing_no?: number;
  slug: string;
  user_id?: string;
  store_id?: string | null;
  category_id?: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  status?: string;
  city: string | null;
  district: string | null;
  neighborhood?: string | null;
  lat?: number | null;
  lng?: number | null;
  images: string[];
  attrs: Record<string, string | number>;
  view_count?: number;
  fav_count?: number;
  message_count?: number;
  phone_reveal_count?: number;
  featured_until?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string;
  category_name?: string;
  category_slug?: string;
  seller_name?: string;
  seller_avatar?: string | null;
  store_name?: string;
  store_slug?: string;
  boosts?: string[];
  rejection_reason?: string | null;
  previous_price?: number | null;
  distance_km?: number | null;
  /** My listings only: what the server accepts for this listing right now. */
  ownerActions?: OwnerAction[];
};

/** A listing on "Son baktıklarım": when it was opened and whether it is still on the air. */
export type RecentListing = Listing & { viewed_at: string; live: boolean };

export type ListingPage = {
  listings: Listing[];
  total: number;
  page: number;
  pages: number;
};

export type Review = { id: string; rating: number; comment: string; reviewer: string; at: string };

export type ListingDetail = {
  listing: Listing;
  isFavorite: boolean;
  isOwner: boolean;
  history: { price: number; at: string }[];
  similar: Listing[];
  reviews: Review[];
  sellerStats: { rating_avg: number; rating_count: number; responseStats?: SellerResponseStats | null };
  favoriteCount: number;
  phoneRevealCount: number;
  attrUnits?: Record<string, string>;
  ownerActions?: OwnerAction[];
  /** Whether "Ara" can show a number; missing from servers before 2026-11. */
  hasPhone?: boolean;
  phoneVisibility?: 'everyone' | 'members' | 'hidden';
  showWhatsapp?: boolean;
  reviewEligibility: { eligible: boolean; existing: { rating: number; comment: string | null } | null };
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon: string | null;
  sort_order: number;
  has_children?: boolean;
};

export type AttrDef = {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'MULTI' | string;
  options: string[] | null;
  unit: string | null;
  required: boolean;
};

export type CategoryInfo = {
  category: Category | null;
  path: Category[];
  children: Category[];
  attributes: AttrDef[];
};

export type BrowseResult = {
  pathRows: Category[];
  children: Category[];
  counts: Record<string, number>;
};

export type SearchFilters = {
  q?: string;
  category?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: SortKey;
  page?: number;
  limit?: number;
  attrs?: Record<string, string | string[] | number>;
  minYear?: number;
  maxYear?: number;
  minKm?: number;
  maxKm?: number;
  minM2?: number;
  maxM2?: number;
  featured?: boolean;
  urgent?: boolean;
  postedWithin?: '1' | '3' | '7' | '30';
  withPhotos?: boolean;
  sellerType?: 'owner' | 'store';
  priceDropped?: boolean;
  userId?: string;
  storeId?: string;
  nearLat?: number;
  nearLng?: number;
  maxDistanceKm?: number;
};

export type SortKey = 'date_desc' | 'date_asc' | 'price_asc' | 'price_desc' | 'views_desc' | 'distance';

export type CategoryPriceStats = {
  count: number;
  p25: number;
  median: number;
  p75: number;
  currency: string;
  cityScoped: boolean;
};

export type SearchResult = { result: ListingPage; inferredCategorySlug: string | null };

export type AutocompleteResult = {
  categories: { name: string; slug: string }[];
  cities: string[];
  listing: { listing_no: number; title: string; slug: string } | null;
};

export type Me = {
  userId: string;
  emailVerified?: boolean;
  listingLimit?: {
    used: number;
    max: number;
    isCorporate: boolean;
  };
  profile: {
    display_name: string;
    phone: string | null;
    bio: string | null;
    city: string | null;
    district: string | null;
    avatar_url: string | null;
    role: string;
    account_type?: 'INDIVIDUAL' | 'CORPORATE';
    listing_count: number;
    active_count: number;
    favorite_count: number;
    rating_avg: number;
    rating_count: number;
    created_at: string;
  } | null;
  store: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    city: string | null;
    description: string;
    phone: string | null;
    logo_url?: string | null;
    business_type?: BusinessType | null;
    sector?: string | null;
    tax_office?: string | null;
    tax_no?: string | null;
    address?: string | null;
  } | null;
  credits: number;
};

export type FollowStatus = {
  following: boolean;
  followers: number;
};

export type FollowedSellerSummary = {
  id: string;
  name: string;
  avatar: string | null;
  city: string | null;
  store_name: string | null;
  store_slug: string | null;
  active_count: number;
  followed_at: string;
};

export type BusinessType = 'SOLE' | 'COMPANY';

export type StoreApplication = {
  id: string;
  name: string;
  business_type: BusinessType | null;
  sector: string | null;
  tax_office: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  tax_no: string | null;
  notes: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  cooldown_until: string | null;
};

export type SellerResponseStats = {
  responseRate?: number | null;
  avgReplyMinutes?: number | null;
};

export type Seller = {
  id: string;
  name: string;
  bio: string;
  city: string;
  since: string;
  avatar_url?: string | null;
  listing_count: number;
  rating_avg: number;
  rating_count: number;
  store: { name: string; slug: string; plan: string; description?: string | null; city?: string | null; logo?: string | null } | null;
  reviews: Review[];
  hasMoreReviews?: boolean;
  responseStats?: SellerResponseStats | null;
  availability?: {
    callHours: string | null;
    awayMode: boolean;
    awayMessage: string | null;
    acceptOffers: boolean;
  } | null;
};

export type Store = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  plan: string;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  created_at: string;
};

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'countered';

export type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  kind: 'text' | 'image' | 'offer' | 'location';
  meta: {
    image_id?: string;
    amount?: number;
    currency?: string;
    status?: OfferStatus;
    counter?: boolean;
    lat?: number;
    lng?: number;
    label?: string;
  } | null;
  deleted: boolean;
  reply: { id: string; sender_id: string; content: string; kind: string } | null;
  created_at: string;
  edited_at?: string | null;
  read_at: string | null;
  /** This app's own id for a message it sent (retries, swapping the "sending" bubble). */
  client_id?: string;
  /** App only: a message not confirmed by the server yet, or one that failed. */
  pending?: 'sending' | 'failed';
};

export type Conversation = {
  id: string;
  role: 'buying' | 'selling';
  listing_id: string;
  listing_title: string;
  listing_slug: string;
  listing_image: string | null;
  listing_status: string;
  price: number;
  currency?: string;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  other_closed: boolean;
  other_online: boolean;
  archived: boolean;
  marked_unread: boolean;
  pinned?: boolean;
  muted?: boolean;
  last_content: string;
  last_kind: string;
  last_deleted: boolean;
  last_sender_id: string;
  unread: number;
  updated_at: string;
};

export type Thread = {
  conversation: {
    id: string;
    role: 'buying' | 'selling';
    listing_id: string;
    listing_title: string;
    listing_slug: string;
    listing_image: string | null;
    listing_price: number | null;
    listing_currency?: string;
    currency?: string;
    listing_status: string;
    other_id: string;
    other_name: string;
    other_closed: boolean;
    other_avatar: string | null;
    other_online: boolean;
    other_last_seen: string | null;
    buyer_id: string;
    seller_id: string;
    pinned?: boolean;
    muted?: boolean;
  };
  messages: ChatMessage[];
  hasMore: boolean;
  firstUnreadId: string | null;
  showReads: boolean;
  blockedByMe: boolean;
  blockedByOther: boolean;
};

export type PhoneVisibility = 'everyone' | 'members' | 'hidden';
export type NotifyType = 'message' | 'favorite' | 'listing' | 'expiry' | 'system';
export type NotifyPrefs = Record<NotifyType, { inapp: boolean; push: boolean }>;

export type AccountSettings = {
  phone_visibility: PhoneVisibility;
  show_whatsapp: boolean;
  read_receipts: boolean;
  notify_prefs: NotifyPrefs;
  push_devices: number;
  message_email: boolean;
  email_ready: boolean;
  email_configured: boolean;
  user_prefs?: UserPrefs;
};

export type QuietHours = {
  enabled: boolean;
  start: string;
  end: string;
};

export type SellerPrefs = {
  accept_offers: boolean;
  call_hours_enabled: boolean;
  call_hours_start: string;
  call_hours_end: string;
  away_mode: boolean;
  away_message: string;
};

export type BrowseSort = 'date_desc' | 'price_asc' | 'price_desc' | 'distance';
export type BrowseView = 'grid' | 'list';

export type BrowsePrefs = {
  default_city: string;
  default_sort: BrowseSort;
  default_view: BrowseView;
};

export type UserPrefs = {
  quiet_hours: QuietHours;
  seller_prefs: SellerPrefs;
  browse_prefs: BrowsePrefs;
};

export type BlockedUser = { id: string; name: string; avatar: string | null; since: string };

export type MobileConfig = {
  homeSections: string[];
  features: Record<string, boolean>;
  mobileApp: {
    min_ios_version: string;
    min_android_version: string;
    announcement: string | null;
    ios_store_url?: string | null;
    android_store_url?: string | null;
  };
  auth?: { google: boolean };
};

export type ListingInput = {
  id?: string;
  categoryId: string;
  title: string;
  description: string;
  price: number;
  currency?: 'TRY' | 'USD' | 'EUR';
  city: string;
  district: string;
  neighborhood?: string;
  lat?: number | null;
  lng?: number | null;
  phone?: string;
  images: string[];
  attrs: Record<string, string | number>;
  storeId?: string;
  clientKey?: string;
};

export type ListingForEdit = {
  listing: Listing;
  path: string[];
  phone: string | null;
};

export type SavedSearchFilterLeaf = string | number | boolean | null;
export type SavedSearchFilters = Record<string, SavedSearchFilterLeaf | SavedSearchFilterLeaf[]>;

export type SavedSearch = {
  id: string;
  user_id: string;
  name: string;
  category_slug: string | null;
  city: string | null;
  district: string | null;
  q: string | null;
  min_price: number | null;
  max_price: number | null;
  filters: SavedSearchFilters;
  notify: boolean;
  last_notified_at: string | null;
  created_at: string;
};
