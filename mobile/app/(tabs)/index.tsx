import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Search, Building2, Car, ShoppingBag, Wrench, PawPrint, Tractor, GraduationCap, Users, Briefcase } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { BrandColors } from '@/constants/Colors';
import { ListingCard, MobileListing } from '@/src/components/listing/ListingCard';
import { getMobileListings, getMobileCategories } from '@/src/api/client';
import { EMBEDDED_CATEGORIES } from '@/src/data/categoriesData';

const SEARCH_TABS = [
  { id: 'all', label: 'Tümü' },
  { id: 'emlak', label: 'Emlak' },
  { id: 'vasita', label: 'Vasıta' },
  { id: 'alisveris', label: 'Alışveriş' },
];

const QUICK_CHIPS = ['Civic', '3+1', 'iPhone', 'kiralık'];

const ICONS: Record<string, any> = {
  home: Building2,
  car: Car,
  bag: ShoppingBag,
  wrench: Wrench,
  paw: PawPrint,
  tractor: Tractor,
  grad: GraduationCap,
  users: Users,
  briefcase: Briefcase,
  cog: Wrench,
  vasita: Car,
  emlak: Building2,
  alisveris: ShoppingBag,
  'yedek-parca': Wrench,
  sanayi: Tractor,
  hizmetler: Wrench,
  'ozel-ders': GraduationCap,
  'is-ilanlari': Briefcase,
  yardimci: Users,
  'hayvanlar-alemi': PawPrint,
};

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [q, setQ] = useState('');

  // 1. Canlı İlan Verileri (Gerçek Veritabanı)
  const { data: apiData, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['mobileListings', activeTab, q],
    queryFn: () =>
      getMobileListings({
        category: activeTab === 'all' ? undefined : activeTab,
        q: q.trim() || undefined,
      }),
  });

  // 2. Canlı Kategori Verileri
  const { data: catData } = useQuery({
    queryKey: ['mobileCategories'],
    queryFn: () => getMobileCategories(),
    initialData: { success: true, categories: EMBEDDED_CATEGORIES },
  });

  const listings: MobileListing[] = (apiData?.listings || []).map((l) => ({
    id: l.id,
    title: l.title,
    price: l.price,
    currency: l.currency,
    images: l.images,
    city: l.city,
    district: l.district,
    created_at: l.created_at,
    is_urgent: l.boosts?.includes('ACIL'),
    is_featured: l.boosts?.includes('KALIN'),
    attrs: l.attrs,
    category_name: l.category_name,
  }));

  const rootCategories = (catData?.categories || []).filter((c) => !c.parent_id);

  const handleSearchSubmit = () => {
    router.push({
      pathname: '/(tabs)/kategoriler',
      params: {
        category: activeTab === 'all' ? undefined : activeTab,
        q: q.trim() || undefined,
      },
    } as any);
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={BrandColors.primary} />}>
      {/* 1. Web Sitesindeki Birebir Hero Bölümü */}
      <View style={styles.heroSection}>
        <Text style={styles.heroPreTitle}>TÜRKİYE İLAN PLATFORMU</Text>
        <Text style={styles.heroMainTitle}>GeldeSat — Emlak, Vasıta ve İkinci El İlanları</Text>
        <Text style={styles.heroSubtitle}>
          {apiData?.total ? `${apiData.total} yayındaki ilan. ` : ''}Ücretsiz ilan verin, satıcıyla doğrudan konuşun.
        </Text>

        {/* Web'deki Arama Kutusu (border border-border bg-bg p-2 shadow-card) */}
        <View style={styles.searchCard}>
          {/* Arama Sekmeleri: Tümü, Emlak, Vasıta, Alışveriş */}
          <View style={styles.searchTabsRow}>
            {SEARCH_TABS.map((t) => {
              const isSelected = activeTab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  style={[styles.searchTabBtn, isSelected && styles.searchTabBtnActive]}>
                  <Text style={[styles.searchTabBtnText, isSelected && styles.searchTabBtnTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Input ve Arama Butonu */}
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <Search size={16} color="#8a929e" style={styles.searchIcon} />
              <TextInput
                placeholder="Örn. Civic, 3+1 kiralık, iPhone"
                placeholderTextColor="#8a929e"
                value={q}
                onChangeText={setQ}
                onSubmitEditing={handleSearchSubmit}
                style={styles.textInput}
              />
            </View>
            <TouchableOpacity style={styles.searchSubmitBtn} onPress={handleSearchSubmit} activeOpacity={0.85}>
              <Text style={styles.searchSubmitBtnText}>Ara</Text>
            </TouchableOpacity>
          </View>

          {/* Hızlı Arama Etiketleri (Civic, 3+1, iPhone, kiralık) */}
          <View style={styles.quickChipsRow}>
            {QUICK_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={styles.quickChip}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/kategoriler',
                    params: { q: chip },
                  } as any)
                }>
                <Text style={styles.quickChipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* 2. Web Sitesindeki Birebir Kategoriler Bölümü */}
      {rootCategories.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kategoriler</Text>
          </View>

          <View style={styles.categoryGrid}>
            {rootCategories.map((c) => {
              const IconComponent = ICONS[c.icon || c.slug] || Building2;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={styles.categoryCard}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/kategoriler',
                      params: { category: c.slug || c.id },
                    } as any)
                  }
                  activeOpacity={0.75}>
                  <IconComponent size={22} color={BrandColors.primary} strokeWidth={2} />
                  <Text style={styles.categoryCardName}>{c.name}</Text>
                  <Text style={styles.categoryCardCount}>İlanları Gör</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 3. Web Sitesindeki Birebir Vitrin Bölümü */}
      <View style={styles.vitrinSection}>
        <View style={styles.vitrinHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Vitrin</Text>
            <Text style={styles.vitrinSubtitle}>Öne çıkan ve güncel ilanlar</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/kategoriler')}>
            <Text style={styles.seeAllText}>Tümü</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={BrandColors.primary} />
          </View>
        ) : listings.length === 0 ? (
          /* Web Sitesindeki Birebir Boş Vitrin Durumu */
          <View style={styles.emptyVitrinBox}>
            <Text style={styles.emptyVitrinText}>Henüz vitrin ilanı yok.</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/ilan-ver')}>
              <Text style={styles.emptyVitrinLink}>İlk ilanı siz verin</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listingGrid}>
            {listings.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                variant="grid"
                onPress={() => router.push(`/ilan/${item.id}` as any)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f8', // Web: --color-bg
  },

  // 1. Hero Bölümü
  heroSection: {
    backgroundColor: '#ffffff', // Web: bg-surface
    borderBottomWidth: 1,
    borderBottomColor: '#d8dee6', // Web: border-border
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
  },
  heroPreTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a4fd8', // Web: text-primary
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroMainTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#12151c', // Web: text-fg
    lineHeight: 28,
    marginTop: 6,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#5a6270', // Web: text-muted
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 14,
  },

  // Arama Kartı
  searchCard: {
    backgroundColor: '#f3f5f8', // Web: bg-bg
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    padding: 10,
  },
  searchTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  searchTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  searchTabBtnActive: {
    backgroundColor: '#0d1117', // Web: bg-ink
  },
  searchTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5a6270',
  },
  searchTabBtnTextActive: {
    color: '#ffffff',
  },

  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 42,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#12151c',
  },
  searchSubmitBtn: {
    backgroundColor: '#1a4fd8',
    borderRadius: 8,
    height: 42,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSubmitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Hızlı Etiketler
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  quickChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8dee6',
    backgroundColor: '#f3f5f8',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  quickChipText: {
    fontSize: 11,
    color: '#5a6270',
    fontWeight: '500',
  },

  // 2. Kategoriler Bölümü
  sectionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#12151c',
    letterSpacing: -0.3,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    padding: 14,
  },
  categoryCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#12151c',
    marginTop: 8,
  },
  categoryCardCount: {
    fontSize: 11,
    color: '#5a6270',
    marginTop: 2,
  },

  // 3. Vitrin Bölümü
  vitrinSection: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#d8dee6',
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  vitrinHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  vitrinSubtitle: {
    fontSize: 12,
    color: '#5a6270',
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a4fd8',
  },
  emptyVitrinBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d8dee6',
    backgroundColor: '#f3f5f8',
    padding: 28,
    alignItems: 'center',
    marginVertical: 10,
  },
  emptyVitrinText: {
    fontSize: 13,
    color: '#5a6270',
    marginBottom: 6,
  },
  emptyVitrinLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a4fd8',
  },
  listingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
