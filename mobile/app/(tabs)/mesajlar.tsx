import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MessageCircle, Search, ChevronRight, X } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { getMobileConversations, MobileConversation } from '@/src/api/client';
import { getStoredUser } from '@/src/api/auth';
import { AuthGate } from '@/src/components/auth/AuthGate';

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<MobileConversation[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const user = await getStoredUser();
      if (!user?.token) {
        setConversations([]);
        setLoadError('');
        return;
      }
      const response = await getMobileConversations(user.token);
      setConversations(response.conversations);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Mesajlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let focused = true;
      let inFlight = false;
      const poll = async () => {
        if (!focused || inFlight || AppState.currentState !== 'active') return;
        inFlight = true;
        try { await loadData(); } finally { inFlight = false; }
      };
      void poll();
      const timer = setInterval(() => { void poll(); }, 20_000);
      const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void poll(); });
      return () => { focused = false; clearInterval(timer); appState.remove(); };
    }, [loadData])
  );

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === 'unread') {
      list = list.filter((c) => c.unread_count > 0);
    }
    if (q.trim()) {
      const s = q.trim().toLocaleLowerCase('tr');
      list = list.filter(
        (c) =>
          c.other_user_name.toLocaleLowerCase('tr').includes(s) ||
          c.listing_title.toLocaleLowerCase('tr').includes(s) ||
          c.last_message.toLocaleLowerCase('tr').includes(s)
      );
    }
    return list;
  }, [conversations, filter, q]);

  return (
    <AuthGate
      title="Mesajlarım"
      subtitle="Alıcı ve satıcılarla anlık mesajlaşabilmek için lütfen giriş yapın veya kayıt olun.">
      <View style={styles.container}>
      {/* 1. Web Sitesindeki Arama ve Filtre Çubuğu */}
      <View style={styles.headerArea}>
        <View style={styles.searchBox}>
          <Search size={16} color="#8a929e" style={{ marginRight: 6 }} />
          <TextInput
            placeholder="Mesajlarda ara..."
            placeholderTextColor="#8a929e"
            value={q}
            onChangeText={setQ}
            style={styles.searchInput}
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ('')}>
              <X size={16} color="#8a929e" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.tabBtn, filter === 'all' && styles.tabBtnActive]}
            onPress={() => setFilter('all')}>
            <Text style={[styles.tabBtnText, filter === 'all' && styles.tabBtnTextActive]}>
              Tümü ({conversations.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, filter === 'unread' && styles.tabBtnActive]}
            onPress={() => setFilter('unread')}>
            <Text style={[styles.tabBtnText, filter === 'unread' && styles.tabBtnTextActive]}>
              Okunmamış
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Konuşma Listesi veya Web ile Birebir Boş Durum */}
      {loading ? (
        <View style={styles.emptyCard}><ActivityIndicator color={BrandColors.primary} /></View>
      ) : loadError ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Mesajlar yüklenemedi</Text>
          <Text style={styles.emptyDesc}>{loadError}</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => void loadData()} accessibilityRole="button">
            <Text style={styles.browseBtnText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.emptyCard}>
            <View style={styles.iconCircle}>
              <MessageCircle size={32} color="#8a929e" />
            </View>
            <Text style={styles.emptyTitle}>Henüz mesajınız yok</Text>
            <Text style={styles.emptyDesc}>
              İlan sahipleriyle iletişime geçtiğinizde veya ilanlarınıza soru sorulduğunda mesajlarınız burada listelenir.
            </Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => router.push('/(tabs)/kategoriler')}>
              <Text style={styles.browseBtnText}>İlanları İncele</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.convRow}
              onPress={() => router.push(`/mesaj/${item.id}` as any)}
              activeOpacity={0.7}>
              {item.listing_image ? (
                <Image source={{ uri: item.listing_image }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarLetter}>
                    {item.other_user_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.convMeta}>
                <View style={styles.topMetaRow}>
                  <Text style={styles.userName}>{item.other_user_name}</Text>
                  <Text style={styles.timeText}>
                    {new Date(item.updated_at).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
                <Text style={styles.adTitle} numberOfLines={1}>
                  {item.listing_title}
                </Text>
                <Text style={styles.lastMsg} numberOfLines={1}>
                  {item.last_sender_id && item.last_sender_id !== item.other_user_id ? 'Siz: ' : ''}{item.last_message}
                </Text>
              </View>
              {item.unread_count > 0 ? <View style={styles.unreadDot} /> : null}
              <ChevronRight size={16} color="#8a929e" />
            </TouchableOpacity>
          )}
        />
      )}
      </View>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f8', // Web: --color-bg
  },
  headerArea: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d8dee6',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f5f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 38,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#12151c',
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f3f5f8',
  },
  tabBtnActive: {
    backgroundColor: '#0d1117', // Web: bg-ink
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5a6270',
  },
  tabBtnTextActive: {
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    marginTop: 40,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    padding: 32,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f5f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#12151c',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#5a6270',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  browseBtn: {
    backgroundColor: '#1a4fd8',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  browseBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Konuşma Satırları
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a4fd8',
  },
  convMeta: {
    flex: 1,
    marginRight: 8,
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1a4fd8', marginRight: 4 },
  topMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#12151c',
  },
  timeText: {
    fontSize: 10,
    color: '#8a929e',
  },
  adTitle: {
    fontSize: 11,
    color: '#1a4fd8',
    fontWeight: '600',
    marginBottom: 2,
  },
  lastMsg: {
    fontSize: 12,
    color: '#5a6270',
  },
});
