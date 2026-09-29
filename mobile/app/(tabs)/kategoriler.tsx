import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  ChevronLeft,
  X,
  Building2,
  Car,
  ShoppingBag,
  Wrench,
  PawPrint,
  Tractor,
  GraduationCap,
  Users,
  Briefcase,
  Layers,
  BookmarkPlus,
} from 'lucide-react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BrandColors } from '@/constants/Colors';
import { ListingCard, MobileListing } from '@/src/components/listing/ListingCard';
import { FilterModal, FilterState } from '@/src/components/listing/FilterModal';
import { createMobileSavedSearch, getMobileListings, getMobileCategories, getMobileCategoryAttributes } from '@/src/api/client';
import { getStoredUser } from '@/src/api/auth';
import { EMBEDDED_CATEGORIES, CategoryItem } from '@/src/data/categoriesData';

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'En Yeni İlanlar' },
  { value: 'date_asc', label: 'En Eski İlanlar' },
  { value: 'price_asc', label: 'Fiyat: Düşükten Yükseğe' },
  { value: 'price_desc', label: 'Fiyat: Yüksekten Düşüğe' },
];

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

export default function SearchPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; q?: string; city?: string; filters?: string }>();

  const [q, setQ] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [sortIndex, setSortIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>({});
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(true);
  const [savingSearch, setSavingSearch] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(q.trim()), 350);
    return () => clearTimeout(timer);
  }, [q]);

  // 1. Canlı / Yerleşik Kategoriler
  const { data: catData } = useQuery({
    queryKey: ['mobileCategories'],
    queryFn: () => getMobileCategories(),
    initialData: { success: true, categories: EMBEDDED_CATEGORIES.map((category) => ({ ...category, icon: category.icon ?? null })) },
  });

  const { data: categoryAttributeData } = useQuery({
    queryKey: ['mobileCategoryAttributes', selectedCatId],
    queryFn: () => getMobileCategoryAttributes(selectedCatId!),
    enabled: Boolean(selectedCatId),
    staleTime: 5 * 60 * 1000,
  });
  const categoryAttributes = categoryAttributeData?.attributes || [];
  const hasVehicleAttributes = categoryAttributes.some((attribute) => ['Yıl', 'KM'].includes(attribute.name));
  const hasPropertyAttributes = categoryAttributes.some((attribute) => attribute.name.includes('m²'));

  const allCategories: CategoryItem[] = useMemo(() => {
    return catData?.categories?.length ? catData.categories : EMBEDDED_CATEGORIES;
  }, [catData]);

  // Sayfaya URL parametresiyle (örn: ana sayfadan) gelindiyse kategoriyi seç
  useEffect(() => {
    if (typeof params.q === 'string') setQ(params.q);
  }, [params.q]);

  useEffect(() => {
    if (typeof params.city === 'string') setActiveFilters((filters) => ({ ...filters, city: params.city }));
  }, [params.city]);

  useEffect(() => {
    if (!params.filters || typeof params.filters !== 'string') return;
    try {
      const parsed = JSON.parse(params.filters) as FilterState & { sort?: string };
      if (parsed && typeof parsed === 'object') setActiveFilters(parsed);
      if (parsed?.sort) {
        const savedSort = SORT_OPTIONS.findIndex((option) => option.value === parsed.sort);
        if (savedSort >= 0) setSortIndex(savedSort);
      }
    } catch { /* Ignore malformed route filter params and keep the defaults. */ }
  }, [params.filters]);

  useEffect(() => {
    if (params?.category) {
      const match = allCategories.find(
        (c) => c.slug === params.category || c.id === params.category
      );
      if (match) {
        setSelectedCatId(match.id);
        setShowCategoryBrowser(true);
      }
    }
  }, [params?.category, allCategories]);

  // Seçili kategori nesnesi
  const currentCategory = useMemo(() => {
    if (!selectedCatId) return null;
    return allCategories.find((c) => c.id === selectedCatId) || null;
  }, [selectedCatId, allCategories]);

  // Kategori Ekmek Kırıntısı (Breadcrumb: Kök -> Alt -> Alt)
  const categoryPath = useMemo(() => {
    const path: CategoryItem[] = [];
    let cur = currentCategory;
    while (cur) {
      path.unshift(cur);
      cur = cur.parent_id ? allCategories.find((c) => c.id === cur?.parent_id) || null : null;
    }
    return path;
  }, [currentCategory, allCategories]);

  // Mevcut seviyedeki alt kategoriler
  const subCategories = useMemo(() => {
    let list: CategoryItem[] = [];
    if (!selectedCatId) {
      list = allCategories.filter((c) => !c.parent_id);
    } else {
      list = allCategories.filter((c) => c.parent_id === selectedCatId);
    }

    if (catSearch.trim()) {
      const s = catSearch.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(s));
    }

    return list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'tr'));
  }, [allCategories, selectedCatId, catSearch]);

  // 2. Canlı İlanlar (Web veritabanından)
  const activeSlug = currentCategory?.slug;
  const { data: apiData, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['mobileSearchListings', debouncedQuery, activeSlug, sortIndex, activeFilters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getMobileListings({
        q: debouncedQuery || undefined,
        category: activeSlug,
        sort: SORT_OPTIONS[sortIndex].value,
        urgent: activeFilters.isUrgentOnly,
        city: activeFilters.city,
        district: activeFilters.district,
        neighborhood: activeFilters.neighborhood,
        minPrice: activeFilters.minPrice,
        maxPrice: activeFilters.maxPrice,
        minYear: activeFilters.minYear,
        maxYear: activeFilters.maxYear,
        minKm: activeFilters.minKm,
        maxKm: activeFilters.maxKm,
        minM2: activeFilters.minM2,
        maxM2: activeFilters.maxM2,
        attrs: activeFilters.attrs,
        limit: 20,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.offset + lastPage.limit < lastPage.total ? lastPage.offset + lastPage.limit : undefined,
  });

  const listings: MobileListing[] = (apiData?.pages.flatMap((page) => page.listings) || []).map((l) => ({
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
    seller_name: l.seller_name,
    store_name: l.store_name,
    user_id: l.user_id,
  }));

  const toggleSort = () => {
    setSortIndex((prev) => (prev + 1) % SORT_OPTIONS.length);
  };

  const saveCurrentSearch = async () => {
    if (savingSearch) return;
    setSavingSearch(true);
    try {
      const user = await getStoredUser();
      if (!user?.token) {
        router.push('/login' as any);
        return;
      }
      const filters = {
        category: activeSlug,
        sort: SORT_OPTIONS[sortIndex].value,
        isUrgentOnly: activeFilters.isUrgentOnly,
        city: activeFilters.city,
        district: activeFilters.district,
        neighborhood: activeFilters.neighborhood,
        minPrice: activeFilters.minPrice,
        maxPrice: activeFilters.maxPrice,
        minYear: activeFilters.minYear,
        maxYear: activeFilters.maxYear,
        minKm: activeFilters.minKm,
        maxKm: activeFilters.maxKm,
        minM2: activeFilters.minM2,
        maxM2: activeFilters.maxM2,
        attrs: activeFilters.attrs,
      };
      const label = [debouncedQuery, currentCategory?.name, activeFilters.city].filter(Boolean).join(' · ') || 'Tüm ilanlar';
      await createMobileSavedSearch(user.token, { label, query: debouncedQuery, filters });
      Alert.alert('Arama kaydedildi', 'Bu aramaya uyan yeni ilanlar için bildirim alacaksınız.');
    } catch (error) {
      Alert.alert('Arama kaydedilemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.');
    } finally {
      setSavingSearch(false);
    }
  };

  const handleSelectCategory = (cat: CategoryItem) => {
    setSelectedCatId(cat.id);
    setCatSearch('');
  };

  const handleGoBackCategory = () => {
    if (!currentCategory) return;
    setSelectedCatId(currentCategory.parent_id || null);
    setCatSearch('');
  };

  const handleClearCategory = () => {
    setSelectedCatId(null);
    setCatSearch('');
  };

  const activeFilterCount = [
    activeFilters.city,
    activeFilters.district,
    activeFilters.neighborhood,
    activeFilters.minPrice,
    activeFilters.maxPrice,
    activeFilters.isUrgentOnly,
    ...Object.values(activeFilters.attrs || {}).flat(),
    activeFilters.minYear,
    activeFilters.maxYear,
    activeFilters.minKm,
    activeFilters.maxKm,
    activeFilters.minM2,
    activeFilters.maxM2,
  ].filter(Boolean).length;

  return (
    <View style={styles.container}>
      {/* 1. Üst Arama ve Filtre Butonu */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBox}>
          <Search size={16} color="#8a929e" style={{ marginRight: 6 }} />
          <TextInput
            placeholder="İlanlar arasında arayın..."
            placeholderTextColor="#8a929e"
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => refetch()}
            style={styles.searchInput}
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ('')} style={{ padding: 4 }}>
              <X size={16} color="#8a929e" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setIsFilterModalOpen(true)}
          activeOpacity={0.8}>
          <SlidersHorizontal size={18} color={activeFilterCount > 0 ? '#ffffff' : '#1a4fd8'} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. Kategori Ağacı ve Navigasyon Çubuğu (GeldeSat / Sahibinden Standartı) */}
      <View style={styles.categoryNavCard}>
        <View style={styles.categoryNavHeader}>
          <View style={styles.categoryNavTitleRow}>
            <Layers size={16} color="#1a4fd8" style={{ marginRight: 6 }} />
            <Text style={styles.categoryNavTitle}>
              {currentCategory ? currentCategory.name : 'Tüm Kategoriler'}
            </Text>
          </View>

          <View style={styles.categoryNavActions}>
            {currentCategory && (
              <TouchableOpacity onPress={handleClearCategory} style={styles.clearCatBtn}>
                <Text style={styles.clearCatText}>Tümünü Gör</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowCategoryBrowser((prev) => !prev)}
              style={styles.toggleBrowserBtn}>
              <Text style={styles.toggleBrowserText}>
                {showCategoryBrowser ? 'Gizle' : 'Kategoriler'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ekmek Kırıntısı (Breadcrumbs) */}
        {categoryPath.length > 0 && (
          <View style={styles.breadcrumbRow}>
            <TouchableOpacity onPress={handleClearCategory}>
              <Text style={styles.breadcrumbLink}>Kategoriler</Text>
            </TouchableOpacity>
            {categoryPath.map((item, idx) => (
              <React.Fragment key={item.id}>
                <ChevronRight size={12} color="#8a929e" style={{ marginHorizontal: 3 }} />
                <TouchableOpacity
                  onPress={() => setSelectedCatId(item.id)}
                  disabled={idx === categoryPath.length - 1}>
                  <Text
                    style={[
                      styles.breadcrumbLink,
                      idx === categoryPath.length - 1 && styles.breadcrumbCurrent,
                    ]}
                    numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Genişletilebilir Kategori Listesi */}
        {showCategoryBrowser && (
          <View style={styles.browserBox}>
            {currentCategory && (
              <TouchableOpacity style={styles.catBackBtn} onPress={handleGoBackCategory}>
                <ChevronLeft size={16} color="#1a4fd8" />
                <Text style={styles.catBackText}>Bir Üst Kategoriye Dön</Text>
              </TouchableOpacity>
            )}

            {/* Alt kategorilerde arama yapma kutusu */}
            {subCategories.length > 6 && (
              <View style={styles.catFilterInputBox}>
                <Search size={14} color="#8a929e" style={{ marginRight: 6 }} />
                <TextInput
                  placeholder="Kategori veya marka ara..."
                  placeholderTextColor="#8a929e"
                  value={catSearch}
                  onChangeText={setCatSearch}
                  style={styles.catFilterInput}
                />
                {catSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCatSearch('')}>
                    <X size={14} color="#8a929e" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView
              style={styles.subCatScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}>
              {subCategories.length === 0 ? (
                <View style={styles.leafBox}>
                  <Text style={styles.leafText}>
                    Bu kategoride alt kırılım bulunmuyor. İlanlar aşağıda listelenmektedir.
                  </Text>
                </View>
              ) : (
                subCategories.map((cat) => {
                  const IconComp = ICONS[cat.icon || cat.slug] || (!cat.parent_id ? Building2 : null);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.subCatRow}
                      onPress={() => handleSelectCategory(cat)}
                      activeOpacity={0.7}>
                      <View style={styles.subCatLeft}>
                        {IconComp && (
                          <View style={styles.catIconWrap}>
                            <IconComp size={16} color="#1a4fd8" />
                          </View>
                        )}
                        <Text style={styles.subCatName}>{cat.name}</Text>
                      </View>
                      <ChevronRight size={15} color="#8a929e" />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* 3. Sıralama ve Görünüm Kontrol Çubuğu */}
      <View style={styles.controlBar}>
        <Text style={styles.resultCountText}>
          {apiData?.pages[0]?.total ?? listings.length} ilan bulundu
        </Text>

        <View style={styles.controlActions}>
          <TouchableOpacity style={styles.sortButton} onPress={() => void saveCurrentSearch()} disabled={savingSearch} accessibilityRole="button" accessibilityLabel="Bu aramayı kaydet">
            <BookmarkPlus size={15} color="#1a4fd8" style={{ marginRight: 4 }} />
            <Text style={styles.sortButtonText}>{savingSearch ? 'Kaydediliyor' : 'Kaydet'}</Text>
          </TouchableOpacity>
          {/* Sıralama Butonu */}
          <TouchableOpacity style={styles.sortButton} onPress={toggleSort} activeOpacity={0.7}>
            <ArrowUpDown size={14} color="#12151c" style={{ marginRight: 4 }} />
            <Text style={styles.sortButtonText}>{SORT_OPTIONS[sortIndex].label}</Text>
          </TouchableOpacity>

          {/* Izgara / Liste Görünüm Değiştirici */}
          <TouchableOpacity
            style={styles.viewToggleBtn}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            {viewMode === 'grid' ? <ListIcon size={18} color="#12151c" /> : <LayoutGrid size={18} color="#12151c" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. İlan Listesi veya Web ile Birebir Boş Durum */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1a4fd8" />
        </View>
      ) : apiData?.pages[0]?.success === false ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyDashedBox}>
            <Text style={styles.emptyTitle}>İlanlar yüklenemedi</Text>
            <Text style={styles.emptyDesc}>{apiData.pages[0].error || 'Bağlantınızı kontrol edip yeniden deneyin.'}</Text>
            <TouchableOpacity style={styles.emptyPrimaryBtn} onPress={() => void refetch()} accessibilityRole="button">
              <Text style={styles.emptyPrimaryBtnText}>Yeniden Dene</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyDashedBox}>
            <Text style={styles.emptyTitle}>Henüz bu kriterde ilan bulunmuyor.</Text>
            <Text style={styles.emptyDesc}>
              {currentCategory ? `"${currentCategory.name}" kategorisinde ilk ilanı siz verin.` : 'Filtreleri sıfırlayarak tüm ilanları görebilir veya yeni bir ilan verebilirsiniz.'}
            </Text>
            <View style={styles.emptyBtnRow}>
              {(selectedCatId || activeFilterCount > 0 || q) && (
                <TouchableOpacity
                  style={styles.emptySecondaryBtn}
                  onPress={() => {
                    setSelectedCatId(null);
                    setActiveFilters({});
                    setQ('');
                  }}>
                  <Text style={styles.emptySecondaryBtnText}>Filtreleri Sıfırla</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.emptyPrimaryBtn}
                onPress={() => router.push('/(tabs)/ilan-ver')}>
                <Text style={styles.emptyPrimaryBtnText}>İlk İlanı Siz Verin</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={listings}
          key={viewMode}
          numColumns={viewMode === 'grid' ? 2 : 1}
          columnWrapperStyle={viewMode === 'grid' ? { justifyContent: 'space-between' } : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              variant={viewMode}
              onPress={() => router.push(`/ilan/${item.id}` as any)}
            />
          )}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }}
          onEndReachedThreshold={0.45}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ padding: 18 }} color={BrandColors.primary} /> : null}
        />
      )}

      {/* 5. Gelişmiş Filtre Modalı */}
      <FilterModal
        visible={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        initialFilters={activeFilters}
        attributes={categoryAttributes}
        showVehicleFilters={hasVehicleAttributes}
        showPropertyFilters={hasPropertyAttributes}
        onApply={(newFilters) => setActiveFilters(newFilters)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f8', // Web: --color-bg
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d8dee6',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f5f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 38,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#12151c',
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f3f5f8',
    borderWidth: 1,
    borderColor: '#d8dee6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: '#1a4fd8',
    borderColor: '#1a4fd8',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#b42318',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Kategori Navigasyon Kartı
  categoryNavCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d8dee6',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryNavHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryNavTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryNavTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#12151c',
  },
  categoryNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearCatBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearCatText: {
    fontSize: 12,
    color: '#1a4fd8',
    fontWeight: '500',
  },
  toggleBrowserBtn: {
    backgroundColor: '#f3f5f8',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d8dee6',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toggleBrowserText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5a6270',
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
    paddingVertical: 2,
  },
  breadcrumbLink: {
    fontSize: 11,
    color: '#1a4fd8',
    fontWeight: '500',
  },
  breadcrumbCurrent: {
    color: '#12151c',
    fontWeight: '700',
  },
  browserBox: {
    marginTop: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
  },
  catBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 4,
    gap: 4,
  },
  catBackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a4fd8',
  },
  catFilterInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    height: 32,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  catFilterInput: {
    flex: 1,
    fontSize: 12,
    color: '#12151c',
  },
  subCatScroll: {
    maxHeight: 180,
  },
  subCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  subCatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  catIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  subCatName: {
    fontSize: 12,
    color: '#12151c',
    fontWeight: '500',
  },
  leafBox: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  leafText: {
    fontSize: 11,
    color: '#5a6270',
    textAlign: 'center',
  },

  // Kontrol Çubuğu
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d8dee6',
  },
  resultCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5a6270',
  },
  controlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f5f8',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d8dee6',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  sortButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#12151c',
  },
  viewToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f3f5f8',
    borderWidth: 1,
    borderColor: '#d8dee6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Yükleme & Boş Durum
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyContainer: {
    padding: 16,
  },
  emptyDashedBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#d8dee6',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#12151c',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#5a6270',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptySecondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    backgroundColor: '#f3f5f8',
  },
  emptySecondaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#12151c',
  },
  emptyPrimaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a4fd8',
  },
  emptyPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Liste
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
});
