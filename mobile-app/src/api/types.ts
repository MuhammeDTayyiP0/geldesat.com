/** Shapes returned by the GeldeSat API (see web/src/routes/api/mobile and web/src/lib/server). */

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
  featured_until?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string;
  category_name?: string;
  category_slug?: string;
  seller_name?: string;
  store_name?: string;
  store_slug?: string;
  boosts?: string[];
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
  sellerStats: { rating_avg: number; rating_count: number };
  favoriteCount: number;
  phoneRevealCount: number;
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
};

export type SortKey = 'date_desc' | 'date_asc' | 'price_asc' | 'price_desc' | 'views_desc';

export type SearchResult = { result: ListingPage; inferredCategorySlug: string | null };

export type Me = {
  userId: string;
  profile: {
    display_name: string;
    phone: string | null;
    bio: string | null;
    city: string | null;
    district: string | null;
    avatar_url: string | null;
    role: string;
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
  } | null;
  credits: number;
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
    status?: OfferStatus;
    counter?: boolean;
    lat?: number;
    lng?: number;
    label?: string;
  } | null;
  deleted: boolean;
  reply: { id: string; sender_id: string; content: string; kind: string } | null;
  created_at: string;
  read_at: string | null;
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
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  other_closed: boolean;
  other_online: boolean;
  archived: boolean;
  marked_unread: boolean;
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
    listing_status: string;
    other_id: string;
    other_name: string;
    other_closed: boolean;
    other_avatar: string | null;
    other_online: boolean;
    other_last_seen: string | null;
    buyer_id: string;
    seller_id: string;
  };
  messages: ChatMessage[];
  hasMore: boolean;
  firstUnreadId: string | null;
  showReads: boolean;
  blockedByMe: boolean;
  blockedByOther: boolean;
};

export type PhoneVisibility = 'everyone' | 'members' | 'hidden';
export type NotifyType = 'message' | 'favorite' | 'listing' | 'expiry';
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
};

export type BlockedUser = { id: string; name: string; avatar: string | null; since: string };

export type MobileConfig = {
  homeSections: string[];
  features: Record<string, boolean>;
  mobileApp: { min_ios_version: string; min_android_version: string; announcement: string | null };
  auth?: { google: boolean };
};

export type ListingInput = {
  id?: string;
  categoryId: string;
  title: string;
  description: string;
  price: number;
  city: string;
  district: string;
  neighborhood?: string;
  phone?: string;
  images: string[];
  attrs: Record<string, string | number>;
  storeId?: string;
};

export type ListingForEdit = {
  listing: Listing;
  path: string[];
  phone: string | null;
};
