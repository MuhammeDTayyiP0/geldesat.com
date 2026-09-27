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
import { BrandColors } from '@/constants/Colors';
import { ListingCard } from '@/src/components/listing/ListingCard';
import { getLocalFavorites, LocalListing } from '@/src/store/localStore';

export default function FavorilerScreen() {
  const router = useRouter();
  const [favs, setFavs] = useState<LocalListing[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        setLoading(true);
        const data = await getLocalFavorites();
        setFavs(data);
        setLoading(false);
      }
      load();
    }, [])
  );

  return (
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
              }}
              variant="list"
              onPress={() => router.push(`/ilan/${item.id}` as any)}
            />
          )}
        />
      )}
    </View>
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
