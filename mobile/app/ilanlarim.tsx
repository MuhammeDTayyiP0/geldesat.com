import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { LayoutGrid, Plus, ChevronLeft, MoreHorizontal, Pencil, Trash2, EyeOff, CheckCircle2, RefreshCw } from 'lucide-react-native';
import { ListingCard } from '@/src/components/listing/ListingCard';
import { getMobileMyListings, updateMobileListingAction } from '@/src/api/client';
import { getStoredUser } from '@/src/api/auth';
import { AuthGate } from '@/src/components/auth/AuthGate';

type MyListing = {
  id: string; title: string; price: number; currency: string; images: string[]; city: string | null;
  district: string | null; created_at: string; category_name?: string; status?: string;
  view_count?: number; expires_at?: string | null;
};

export default function IlanlarimScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<MyListing | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const user = await getStoredUser();
      if (!user?.token) { setListings([]); return; }
      const response = await getMobileMyListings(user.token);
      setListings(response.listings);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'İlanlarınız yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSetStatus = async (id: string, status: 'ACTIVE' | 'SOLD' | 'INACTIVE') => {
    const user = await getStoredUser();
    if (!user?.token) return;
    try { await updateMobileListingAction(id, 'status', user.token, status); await loadData(); }
    catch (error) { Alert.alert('İşlem başarısız', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.'); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('İlanı Sil', 'Bu ilanı silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const user = await getStoredUser();
          if (!user?.token) return;
          try { await updateMobileListingAction(id, 'delete', user.token); await loadData(); }
          catch (error) { Alert.alert('İlan silinemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.'); }
        },
      },
    ]);
  };

  const handleRenew = async (id: string) => {
    const user = await getStoredUser();
    if (!user?.token) return;
    try { await updateMobileListingAction(id, 'renew', user.token); await loadData(); }
    catch (error) { Alert.alert('İlan yenilenemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.'); }
  };

  const showActions = (item: MyListing) => {
    setSelectedListing(item);
  };

  const listingActions = (item: MyListing) => {
    const expired = Boolean(item.expires_at && new Date(item.expires_at).getTime() <= Date.now());
    const isPending = item.status === 'PENDING';
    const isRejected = item.status === 'REJECTED';
    const choices: Array<{ label: string; icon: React.ReactNode; danger?: boolean; onPress: () => void }> = [
      { label: 'Düzenle', icon: <Pencil size={18} color="#1a4fd8" />, onPress: () => router.push({ pathname: '/(tabs)/ilan-ver', params: { id: item.id } } as any) },
    ];
    if (!isPending && !isRejected && !expired && item.status === 'ACTIVE') {
      choices.push({ label: 'Yayından kaldır', icon: <EyeOff size={18} color="#5a6270" />, onPress: () => handleSetStatus(item.id, 'INACTIVE') });
      choices.push({ label: 'Satıldı olarak işaretle', icon: <CheckCircle2 size={18} color="#1f7a4d" />, onPress: () => handleSetStatus(item.id, 'SOLD') });
    } else if (!isPending && !isRejected && !expired && (item.status === 'INACTIVE' || item.status === 'SOLD')) {
      choices.push({ label: 'Tekrar yayına al', icon: <CheckCircle2 size={18} color="#1a4fd8" />, onPress: () => handleSetStatus(item.id, 'ACTIVE') });
    }
    if (!isRejected && (expired || item.status !== 'ACTIVE')) {
      choices.push({ label: expired ? '30 gün uzat ve yenile' : '30 gün uzat', icon: <RefreshCw size={18} color="#1a4fd8" />, onPress: () => handleRenew(item.id) });
    }
    choices.push({ label: 'İlanı sil', icon: <Trash2 size={18} color="#b42318" />, danger: true, onPress: () => handleDelete(item.id) });
    return choices;
  };

  return (
    <AuthGate title="İlanlarım" subtitle="İlanlarınızı yönetmek için giriş yapın.">
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
              style={styles.headerIconButton}
              accessibilityRole="button"
              accessibilityLabel="Yeni ilan ver"
              hitSlop={8}>
              <Plus size={21} color="#12151c" />
            </TouchableOpacity>
          ),
        }}
      />

      <Modal transparent animationType="slide" visible={Boolean(selectedListing)} onRequestClose={() => setSelectedListing(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedListing(null)}>
          <Pressable style={styles.actionSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>İlan işlemleri</Text>
            <Text style={styles.sheetSubtitle} numberOfLines={1}>{selectedListing?.title}</Text>
            {selectedListing ? listingActions(selectedListing).map((action) => (
              <TouchableOpacity key={action.label} style={styles.sheetAction} onPress={() => { setSelectedListing(null); action.onPress(); }}>
                {action.icon}<Text style={[styles.sheetActionText, action.danger && styles.sheetDanger]}>{action.label}</Text>
              </TouchableOpacity>
            )) : null}
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setSelectedListing(null)}><Text style={styles.sheetCancelText}>Kapat</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color="#1a4fd8" />
        </View>
      ) : loadError ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}><Text style={styles.retryText}>Yeniden Dene</Text></TouchableOpacity>
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
            const isInactive = item.status === 'INACTIVE';
            const isPending = item.status === 'PENDING';
            const expired = Boolean(item.expires_at && new Date(item.expires_at).getTime() <= Date.now());
            return (
              <View style={styles.listingWrapper}>
                {/* Durum Rozeti */}
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'SOLD' && styles.statusBadgeSold,
                      isInactive && styles.statusBadgeInactive,
                    ]}>
                    <Text style={styles.statusBadgeText}>
                      {isPending ? 'İncelemede' : item.status === 'SOLD' ? 'Satıldı' : isInactive ? 'Yayından Kaldırıldı' : item.status === 'REJECTED' ? 'Reddedildi' : expired ? 'Süresi doldu' : 'Yayında'}
                    </Text>
                  </View>
                  <Text style={styles.viewsText}>{item.view_count || 0} görüntülenme</Text>
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
                    user_id: (item as MyListing & { user_id?: string }).user_id,
                  }}
                  variant="list"
                  isOwner
                  onPress={() => router.push(`/ilan/${item.id}` as any)}
                />

                <View style={styles.actionsBar}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => showActions(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`İşlemler: ${item.title}`}>
                    <MoreHorizontal size={17} color="#1a4fd8" />
                    <Text style={styles.actionBtnText}>İşlemler</Text>
                  </TouchableOpacity>
                  {item.expires_at ? <Text style={styles.expiryText}>{expired ? 'Süresi doldu' : `Bitiş: ${new Date(item.expires_at).toLocaleDateString('tr-TR')}`}</Text> : null}
                </View>
              </View>
            );
          }}
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
  headerIconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -4 },
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
    justifyContent: 'space-between',
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
  expiryText: { flex: 1, textAlign: 'right', color: '#5a6270', fontSize: 11 },
  errorText: { color: '#b42318', fontSize: 14, textAlign: 'center', marginHorizontal: 24 },
  retryButton: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', marginTop: 12, borderRadius: 8, backgroundColor: '#1a4fd8' },
  retryText: { color: '#fff', fontWeight: '700' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,16,28,0.35)' },
  actionSheet: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#fff' },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#cbd2dc', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { color: '#12151c', fontSize: 18, fontWeight: '700' }, sheetSubtitle: { color: '#687382', fontSize: 12, marginTop: 3, marginBottom: 10 },
  sheetAction: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e7ebf0' },
  sheetActionText: { color: '#12151c', fontSize: 14, fontWeight: '600' }, sheetDanger: { color: '#b42318' },
  sheetCancel: { minHeight: 46, justifyContent: 'center', alignItems: 'center', marginTop: 10, backgroundColor: '#f3f5f8', borderRadius: 10 }, sheetCancelText: { color: '#12151c', fontWeight: '700' },
});
