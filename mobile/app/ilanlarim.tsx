import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { LayoutGrid, Plus, ChevronLeft, Trash2, CheckCircle2, EyeOff } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { ListingCard } from '@/src/components/listing/ListingCard';
import {
  getMyLocalListings,
  updateListingStatus,
  deleteMyLocalListing,
  LocalListing,
} from '@/src/store/localStore';

export default function IlanlarimScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<LocalListing[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getMyLocalListings();
    setListings(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSetStatus = async (id: string, status: 'ACTIVE' | 'SOLD' | 'INACTIVE') => {
    await updateListingStatus(id, status);
    loadData();
  };

  const handleDelete = (id: string) => {
    Alert.alert('İlanı Sil', 'Bu ilanı silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await deleteMyLocalListing(id);
          loadData();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: 'İlanlarım',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 10 }}>
              <ChevronLeft size={24} color="#12151c" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/ilan-ver')}
              style={styles.newAdBtn}>
              <Plus size={16} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.newAdBtnText}>Yeni İlan</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color="#1a4fd8" />
        </View>
      ) : listings.length === 0 ? (
        /* Web Sitesindeki Birebir Boş İlanlarım Kutusu */
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <LayoutGrid size={44} color="#8a929e" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Henüz bir ilanınız bulunmuyor.</Text>
            <Text style={styles.emptyDesc}>
              Emlak, vasıta veya ikinci el eşyalarınızı Türkiye'nin her yerine hemen ücretsiz ilan vererek satabilirsiniz.
            </Text>
            <TouchableOpacity
              style={styles.publishBtn}
              onPress={() => router.push('/(tabs)/ilan-ver')}>
              <Text style={styles.publishBtnText}>İlk İlanı Ücretsiz Verin</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSold = item.status === 'SOLD';
            const isInactive = item.status === 'INACTIVE';
            return (
              <View style={styles.listingWrapper}>
                {/* Durum Rozeti */}
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      isSold && styles.statusBadgeSold,
                      isInactive && styles.statusBadgeInactive,
                    ]}>
                    <Text style={styles.statusBadgeText}>
                      {isSold ? 'Satıldı' : isInactive ? 'Yayından Kaldırıldı' : 'Yayında'}
                    </Text>
                  </View>
                  <Text style={styles.viewsText}>{item.view_count || 1} görüntülenme</Text>
                </View>

                {/* İlan Kartı */}
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
                    category_name: item.category_name,
                  }}
                  variant="list"
                  onPress={() => router.push(`/ilan/${item.id}` as any)}
                />

                {/* Aksiyon Butonları (Web ile Birebir) */}
                <View style={styles.actionsBar}>
                  {!isSold && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleSetStatus(item.id, 'SOLD')}>
                      <CheckCircle2 size={14} color="#1f7a4d" style={{ marginRight: 4 }} />
                      <Text style={[styles.actionBtnText, { color: '#1f7a4d' }]}>Satıldı Yap</Text>
                    </TouchableOpacity>
                  )}

                  {!isInactive ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleSetStatus(item.id, 'INACTIVE')}>
                      <EyeOff size={14} color="#5a6270" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnText}>Yayından Kaldır</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleSetStatus(item.id, 'ACTIVE')}>
                      <Text style={[styles.actionBtnText, { color: '#1a4fd8' }]}>Tekrar Yayına Al</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDelete(item.id)}>
                    <Trash2 size={14} color="#b42318" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
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
  newAdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a4fd8',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  newAdBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
  publishBtn: {
    backgroundColor: '#1a4fd8',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  publishBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  listingWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    padding: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeSold: {
    backgroundColor: '#f3e8ff',
    borderColor: '#d8b4fe',
  },
  statusBadgeInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  viewsText: {
    fontSize: 11,
    color: '#8a929e',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 10,
    paddingTop: 8,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#12151c',
  },
  deleteBtn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2',
  },
});
