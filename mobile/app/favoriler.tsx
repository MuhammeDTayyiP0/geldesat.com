import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { Heart, ChevronLeft } from 'lucide-react-native';
import { ListingCard, MobileListing } from '@/src/components/listing/ListingCard';
import { getMobileFavorites } from '@/src/api/client';
import { getStoredUser } from '@/src/api/auth';
import { AuthGate } from '@/src/components/auth/AuthGate';

export default function FavorilerScreen() {
  const router = useRouter();
  const [favs, setFavs] = useState<MobileListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadFavorites = useCallback(async (isActive: () => boolean = () => true) => {
    if (isActive()) { setLoading(true); setLoadError(''); }
    try {
      const user = await getStoredUser();
      if (!user?.token) {
        if (isActive()) setFavs([]);
        return;
      }
      const response = await getMobileFavorites(user.token);
      if (isActive()) setFavs(response.listings.map((item) => ({
        id: item.id, slug: item.slug, title: item.title, price: item.price, currency: item.currency,
        images: item.images, city: item.city, district: item.district, created_at: item.created_at,
        is_urgent: item.boosts?.includes('ACIL'), is_featured: item.boosts?.includes('KALIN'),
        category_name: item.category_name,
        seller_name: item.seller_name,
        store_name: item.store_name,
        user_id: item.user_id,
      })));
    } catch (error) {
      if (isActive()) setLoadError(error instanceof Error ? error.message : 'Favoriler yüklenemedi.');
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadFavorites(() => active);
      return () => { active = false; };
    }, [loadFavorites])
  );

  return (
    <AuthGate title="Favorilerim" subtitle="Favori ilanlarınızı görüntülemek için giriş yapın.">
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: 'Favori İlanlarım',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 10 }}>
              <ChevronLeft size={24} color="#12151c" />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color="#1a4fd8" />
        </View>
      ) : loadError ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Favoriler yüklenemedi</Text>
            <Text style={styles.emptyDesc}>{loadError}</Text>
            <TouchableOpacity style={styles.browseBtn} onPress={() => void loadFavorites()}>
              <Text style={styles.browseBtnText}>Yeniden Dene</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : favs.length === 0 ? (
        /* Web Sitesindeki Birebir Boş Favoriler Kutusu */
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Heart size={44} color="#8a929e" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Henüz favori ilanınız yok.</Text>
            <Text style={styles.emptyDesc}>
              Beğendiğiniz ilanları kalp butonuna basarak favorilerinize ekleyebilir ve daha sonra kolayca bulabilirsiniz.
            </Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => router.push('/(tabs)/kategoriler')}>
              <Text style={styles.browseBtnText}>İlanlara Göz At</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={favs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ListingCard
              listing={{
                id: item.id,
                title: item.title,
                price: item.price,
                currency: item.currency,
                images: item.images,
                city: item.city,
                district: item.district,
                created_at: item.created_at,
                is_urgent: item.is_urgent,
                is_featured: item.is_featured,
                category_name: item.category_name,
                seller_name: item.seller_name,
                store_name: item.store_name,
                user_id: item.user_id,
              }}
              variant="list"
              onPress={() => router.push(`/ilan/${item.id}` as any)}
            />
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
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    marginTop: 40,
  },
  emptyCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#d8dee6',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#12151c',
    marginBottom: 6,
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
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  browseBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
});
