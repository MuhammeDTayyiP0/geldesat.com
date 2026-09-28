import * as SecureStore from 'expo-secure-store';

export interface LocalListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  description: string;
  city: string | null;
  district: string | null;
  neighborhood?: string | null;
  images: string[];
  phone?: string | null;
  attrs: Record<string, string | number>;
  created_at: string;
  category_name?: string;
  category_slug?: string;
  seller_name?: string;
  seller_id?: string;
  store_name?: string;
  store_slug?: string;
  view_count?: number;
  status?: 'ACTIVE' | 'PENDING' | 'SOLD' | 'INACTIVE' | 'REJECTED';
  expires_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_urgent?: boolean;
  is_featured?: boolean;
}

export interface LocalMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface LocalConversation {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_image?: string;
  listing_price?: number;
  other_user_name: string;
  last_message: string;
  updated_at: string;
  unread_count: number;
  messages: LocalMessage[];
}

const FAVS_KEY = 'geldesat_fav_listings';
const MY_LISTINGS_KEY = 'geldesat_my_listings';
const CONVS_KEY = 'geldesat_my_conversations';

// ================= FAVORİLER =================
export async function getLocalFavorites(): Promise<LocalListing[]> {
  try {
    const raw = await SecureStore.getItemAsync(FAVS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function isFavorite(id: string): Promise<boolean> {
  const favs = await getLocalFavorites();
  return favs.some((f) => f.id === id);
}

export async function toggleLocalFavorite(listing: LocalListing): Promise<boolean> {
  try {
    let favs = await getLocalFavorites();
    const exists = favs.some((f) => f.id === listing.id);
    if (exists) {
      favs = favs.filter((f) => f.id !== listing.id);
    } else {
      favs.unshift(listing);
    }
    await SecureStore.setItemAsync(FAVS_KEY, JSON.stringify(favs));
    return !exists;
  } catch {
    return false;
  }
}

// ================= İLANLARIM =================
export async function getMyLocalListings(): Promise<LocalListing[]> {
  try {
    const raw = await SecureStore.getItemAsync(MY_LISTINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveMyLocalListing(listing: LocalListing): Promise<void> {
  try {
    const list = await getMyLocalListings();
    const filtered = list.filter((l) => l.id !== listing.id);
    filtered.unshift(listing);
    await SecureStore.setItemAsync(MY_LISTINGS_KEY, JSON.stringify(filtered));
  } catch {}
}

export async function updateListingStatus(id: string, status: 'ACTIVE' | 'SOLD' | 'INACTIVE'): Promise<void> {
  try {
    const list = await getMyLocalListings();
    const updated = list.map((l) => (l.id === id ? { ...l, status } : l));
    await SecureStore.setItemAsync(MY_LISTINGS_KEY, JSON.stringify(updated));
  } catch {}
}

export async function deleteMyLocalListing(id: string): Promise<void> {
  try {
    const list = await getMyLocalListings();
    const filtered = list.filter((l) => l.id !== id);
    await SecureStore.setItemAsync(MY_LISTINGS_KEY, JSON.stringify(filtered));
  } catch {}
}

// ================= MESAJLAR & KONUŞMALAR =================
export async function getLocalConversations(): Promise<LocalConversation[]> {
  try {
    const raw = await SecureStore.getItemAsync(CONVS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getLocalThread(id: string): Promise<LocalConversation | null> {
  const convs = await getLocalConversations();
  return convs.find((c) => c.id === id) || null;
}

export async function saveLocalMessage(conversationId: string, content: string, senderId: string): Promise<LocalConversation | null> {
  try {
    const convs = await getLocalConversations();
    const idx = convs.findIndex((c) => c.id === conversationId);
    if (idx === -1) return null;

    const newMsg: LocalMessage = {
      id: 'msg_' + Date.now(),
      sender_id: senderId,
      content,
      created_at: new Date().toISOString(),
    };

    convs[idx].messages.push(newMsg);
    convs[idx].last_message = content;
    convs[idx].updated_at = newMsg.created_at;

    await SecureStore.setItemAsync(CONVS_KEY, JSON.stringify(convs));
    return convs[idx];
  } catch {
    return null;
  }
}

export async function createLocalConversation(listing: LocalListing, initialMessage: string): Promise<string> {
  try {
    const convs = await getLocalConversations();
    const existing = convs.find((c) => c.listing_id === listing.id);
    if (existing) {
      await saveLocalMessage(existing.id, initialMessage, 'me');
      return existing.id;
    }

    const convId = 'conv_' + Date.now();
    const newConv: LocalConversation = {
      id: convId,
      listing_id: listing.id,
      listing_title: listing.title,
      listing_image: listing.images?.[0],
      listing_price: listing.price,
      other_user_name: listing.seller_name || 'Satıcı',
      last_message: initialMessage,
      updated_at: new Date().toISOString(),
      unread_count: 0,
      messages: [
        {
          id: 'msg_' + Date.now(),
          sender_id: 'me',
          content: initialMessage,
          created_at: new Date().toISOString(),
        },
      ],
    };

    convs.unshift(newConv);
    await SecureStore.setItemAsync(CONVS_KEY, JSON.stringify(convs));
    return convId;
  } catch {
    return 'conv_' + Date.now();
  }
}
