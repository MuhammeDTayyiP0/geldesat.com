import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Camera,
  Image as ImageIcon,
  X,
  Check,
  Building2,
  Car,
  ShoppingBag,
  Wrench,
  ChevronRight,
  ChevronLeft,
  PawPrint,
  Tractor,
  GraduationCap,
  Users,
  Briefcase,
  Search,
  MapPin,
  Eye,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BrandColors } from '@/constants/Colors';
import { EMBEDDED_CATEGORIES, CategoryItem } from '@/src/data/categoriesData';
import { TURKEY_CITIES } from '@/src/data/locations';
import { AuthGate } from '@/src/components/auth/AuthGate';
import { getStoredUser } from '@/src/api/auth';
import { createMobileListing, getMobileCategoryAttributes, getMobileMyListing, getMobileProfile, MobileAttribute } from '@/src/api/client';

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

const STEPS = ['Kategori', 'Detay', 'Fotoğraf', 'Önizleme'];

export default function PostAdScreen() {
  const router = useRouter();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();

  // Web ile 1:1 4-Aşama: 0: Kategori, 1: Detay, 2: Fotoğraf, 3: Önizleme
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [path, setPath] = useState<string[]>([]);
  const [catSearch, setCatSearch] = useState('');
  const [categoryAttributes, setCategoryAttributes] = useState<MobileAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string | number>>({});
  const [attributesLoading, setAttributesLoading] = useState(false);

  // Form Verileri (Detay)
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [phone, setPhone] = useState('');

  // Fotoğraflar
  const [images, setImages] = useState<string[]>([]);
  const [imagePayloads, setImagePayloads] = useState<Record<string, string>>({});

  // Şehir / İlçe Modalları
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const selectedCatId = path[path.length - 1] || null;

  useEffect(() => {
    let active = true;
    async function loadForEdit() {
      if (!editId) { setIsEditing(false); return; }
      const user = await getStoredUser();
      if (!user?.token) return;
      try {
        const response = await getMobileMyListing(editId, user.token);
        if (!active) return;
        const listing = response.listing;
        const chain: CategoryItem[] = [];
        let current = EMBEDDED_CATEGORIES.find((item) => item.id === listing.category_id) || null;
        while (current) {
          chain.unshift(current);
          current = current.parent_id ? EMBEDDED_CATEGORIES.find((item) => item.id === current?.parent_id) || null : null;
        }
        setPath(chain.map((item) => item.id));
        setTitle(listing.title);
        setPrice(String(listing.price));
        setDescription(listing.description);
        setCity(listing.city || '');
        setDistrict(listing.district || '');
        setPhone(listing.phone || '');
        setNeighborhood(listing.neighborhood || '');
        setImages(listing.images || []);
        setImagePayloads({});
        setAttributeValues(listing.attrs ?? {});
        setStep(1);
        setIsEditing(true);
      } catch (error) {
        Alert.alert('İlan yüklenemedi', error instanceof Error ? error.message : 'İlan düzenleme bilgileri alınamadı.');
      }
    }
    void loadForEdit();
    return () => { active = false; };
  }, [editId]);

  useEffect(() => {
    if (editId) return;
    let active = true;
    async function loadProfileDefaults() {
      const user = await getStoredUser();
      if (!user?.token) return;
      try {
        const response = await getMobileProfile(user.token);
        if (!active || !response.profile) return;
        setPhone(response.profile.phone || '');
        setCity(response.profile.city || '');
        setDistrict(response.profile.district || '');
      } catch {}
    }
    void loadProfileDefaults();
    return () => { active = false; };
  }, [editId]);

  useEffect(() => {
    let active = true;
    if (!selectedCatId) {
      setCategoryAttributes([]);
      return () => { active = false; };
    }
    setAttributesLoading(true);
    getMobileCategoryAttributes(selectedCatId)
      .then((response) => { if (active) setCategoryAttributes(response.attributes); })
      .catch(() => { if (active) setCategoryAttributes([]); })
      .finally(() => { if (active) setAttributesLoading(false); });
    return () => { active = false; };
  }, [selectedCatId]);

  // Kategori Hiyerarşisi
  const currentCategory = useMemo(() => {
    if (!selectedCatId) return null;
    return EMBEDDED_CATEGORIES.find((c) => c.id === selectedCatId) || null;
  }, [selectedCatId]);

  const pathRows = useMemo(() => {
    return path
      .map((id) => EMBEDDED_CATEGORIES.find((c) => c.id === id))
      .filter(Boolean) as CategoryItem[];
  }, [path]);

  const currentChildren = useMemo(() => {
    let list = EMBEDDED_CATEGORIES.filter((c) => c.parent_id === selectedCatId);
    if (catSearch.trim()) {
      const q = catSearch.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'tr'));
  }, [selectedCatId, catSearch]);

  const isVehicle = useMemo(() => {
    return path.some((id) => id.includes('vasita') || id.includes('oto') || id.includes('moto'));
  }, [path]);

  const isProperty = useMemo(() => {
    return path.some((id) => id.includes('emlak') || id.includes('konut') || id.includes('arsa'));
  }, [path]);

  const needsPhoto = isVehicle || isProperty;

  // Şehir & İlçe
  const selectedCityData = useMemo(() => {
    return TURKEY_CITIES.find((c) => c.name === city);
  }, [city]);

  const filteredCities = useMemo(() => {
    if (!citySearchQuery.trim()) return TURKEY_CITIES;
    const q = citySearchQuery.trim().toLowerCase();
    return TURKEY_CITIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [citySearchQuery]);

  // Kategori Seçimi (Brand -> Series -> Model)
  const handleSelectCategory = (cat: CategoryItem) => {
    const nextPath = [...path, cat.id];
    setPath(nextPath);
    setAttributeValues({});
    setCatSearch('');

    // Alt kategori kontrolü (BMW -> Series -> Model -> Leaf)
    const hasMore = EMBEDDED_CATEGORIES.some((c) => c.parent_id === cat.id);
    if (!hasMore) {
      // Yaprak kategori seçildi, otomatik Detay adımına geç
      setStep(1);
    }
  };

  const handleBackCategory = () => {
    if (path.length > 0) {
      setPath(path.slice(0, -1));
      setAttributeValues({});
      setCatSearch('');
    }
  };

  // Fotoğraf Yükleme
  const handleTakePhoto = async () => {
    if (images.length >= 10) {
      Alert.alert('Sınır', 'En fazla 10 adet fotoğraf yükleyebilirsiniz.');
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Fotoğraf çekebilmek için kamera izni vermelisiniz.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.55,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      setImages((prev) => [...prev, asset.uri]);
      if (asset.base64) setImagePayloads((prev) => ({ ...prev, [asset.uri]: `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` }));
    }
  };

  const handlePickImages = async () => {
    if (images.length >= 10) {
      Alert.alert('Sınır', 'En fazla 10 adet fotoğraf yükleyebilirsiniz.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Fotoğraf yükleyebilmek için galeri izni vermelisiniz.');
      return;
    }

    const remaining = 10 - images.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.55,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      setImagePayloads((prev) => {
        const next = { ...prev };
        for (const asset of result.assets) {
          if (asset.base64) next[asset.uri] = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
        }
        return next;
      });
    }
  };

  const handleMakeCover = (index: number) => {
    if (index === 0) return;
    setImages((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
  };

  const handleRemoveImage = (index: number) => {
    const removed = images[index];
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePayloads((prev) => { const next = { ...prev }; delete next[removed]; return next; });
  };

  // Doğrulama ve Adım Geçişleri
  const handleProceedToPhotos = () => {
    if (title.trim().length < 5) {
      Alert.alert('Eksik Bilgi', 'İlan başlığı en az 5 karakter olmalıdır.');
      return;
    }
    const numPrice = Number(price.replace(/[^0-9]/g, ''));
    if (!numPrice || numPrice <= 0) {
      Alert.alert('Eksik Bilgi', 'Lütfen geçerli bir fiyat giriniz.');
      return;
    }
    if (description.trim().length < 10) {
      Alert.alert('Eksik Bilgi', 'İlan açıklaması en az 10 karakter olmalıdır.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen il seçiniz.');
      return;
    }
    if (!district.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen ilçe seçiniz.');
      return;
    }
    setStep(2);
  };

  const handleProceedToPreview = () => {
    if (needsPhoto && images.length === 0) {
      Alert.alert('Fotoğraf Zorunlu', 'Emlak ve vasıta ilanlarında en az 1 fotoğraf yüklenmesi zorunludur.');
      return;
    }
    setStep(3);
  };

  // İlan Yayınlama
  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      const user = await getStoredUser();
      if (!user?.token) throw new Error('İlan vermek için yeniden giriş yapın.');
      const attrs = attributeValues;
      const response = await createMobileListing({
        id: editId || undefined,
        categoryId: selectedCatId,
        title: title.trim(),
        price: Number(price.replace(/[^0-9]/g, '')) || 0,
        description: description.trim(),
        city: city.trim(),
        district: district.trim(),
        neighborhood: neighborhood.trim() || undefined,
        phone: phone.trim() || undefined,
        images: images.map((uri) => imagePayloads[uri] || uri),
        attrs,
      }, user.token);
      setIsSubmitting(false);
      const reviewText = response.status === 'PENDING'
        ? 'İlanınız kaydedildi ve inceleme için sıraya alındı.'
        : 'İlanınız başarıyla yayınlandı.';
      Alert.alert(isEditing ? 'İlan güncellendi' : 'İlan kaydedildi', isEditing ? 'Değişiklikleriniz kaydedildi.' : reviewText, [
        {
          text: 'İlanı Gör',
          onPress: () => {
            setStep(0);
            setPath([]);
            setTitle('');
            setPrice('');
            setCity('');
            setDistrict('');
            setNeighborhood('');
            setPhone('');
            setDescription('');
            setImages([]);
            setImagePayloads({});
            setIsEditing(false);
            setAttributeValues({});
            router.push(`/ilan/${response.id}` as any);
          },
        },
      ]);
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert('İlan kaydedilemedi', error instanceof Error ? error.message : 'Lütfen bilgileri kontrol edip tekrar deneyin.');
    }
  };

  return (
    <AuthGate
      title="Ücretsiz İlan Ver"
      subtitle="İlan verebilmek için lütfen giriş yapın veya ücretsiz hesap oluşturun.">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* ======================================================== */}
        {/* WEB SİTESİ İLE 1:1 STEPPER ÇUBUĞU                         */}
        {/* ======================================================== */}
        <View style={styles.stepperContainer}>
          {STEPS.map((s, i) => {
            const isDone = i < step;
            const isCurrent = i === step;
            return (
              <View key={s} style={styles.stepCol}>
                <View
                  style={[
                    styles.stepCircle,
                    isDone && styles.stepCircleDone,
                    isCurrent && styles.stepCircleCurrent,
                  ]}>
                  {isDone ? (
                    <Check size={14} color="#ffffff" strokeWidth={3} />
                  ) : (
                    <Text
                      style={[
                        styles.stepNum,
                        isCurrent && styles.stepNumCurrent,
                      ]}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    (isDone || isCurrent) && styles.stepLabelActive,
                  ]}>
                  {s}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ======================================================== */}
        {/* ADIM 0: KATEGORİ SEÇİMİ (Brand -> Series -> Model)       */}
        {/* ======================================================== */}
        {step === 0 && (
          <View>
            <Text style={styles.pageTitle}>Kategori Seçin</Text>
            <Text style={styles.pageSubtitle}>
              İlanınızın doğru kitleye ulaşması için marka ve modelinizi adım adım belirleyin.
            </Text>

            {/* Ekmek Kırıntısı (Breadcrumb) */}
            {pathRows.length > 0 && (
              <View style={styles.breadcrumbCard}>
                <TouchableOpacity onPress={() => { setPath([]); setAttributeValues({}); }}>
                  <Text style={styles.breadcrumbLink}>Kategoriler</Text>
                </TouchableOpacity>
                {pathRows.map((cat, idx) => (
                  <React.Fragment key={cat.id}>
                    <ChevronRight size={12} color="#8a929e" style={{ marginHorizontal: 2 }} />
                    <TouchableOpacity
                      onPress={() => { setPath(path.slice(0, idx + 1)); setAttributeValues({}); }}
                      disabled={idx === pathRows.length - 1}>
                      <Text
                        style={[
                          styles.breadcrumbLink,
                          idx === pathRows.length - 1 && styles.breadcrumbActive,
                        ]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* Geri Dön Butonu */}
            {path.length > 0 && (
              <TouchableOpacity style={styles.backBtnRow} onPress={handleBackCategory}>
                <ChevronLeft size={16} color="#1a4fd8" />
                <Text style={styles.backBtnText}>← Bir Üst Seviyeye Dön</Text>
              </TouchableOpacity>
            )}

            {/* Arama Kutusu (Seçenekler çoksa) */}
            {currentChildren.length > 5 && (
              <View style={styles.catSearchBox}>
                <Search size={15} color="#8a929e" style={{ marginRight: 6 }} />
                <TextInput
                  placeholder="Kategori, marka veya model ara..."
                  placeholderTextColor="#8a929e"
                  value={catSearch}
                  onChangeText={setCatSearch}
                  style={styles.catSearchInput}
                />
                {catSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCatSearch('')}>
                    <X size={15} color="#8a929e" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Kategori Listesi */}
            <View style={styles.catListBox}>
              {currentChildren.length === 0 ? (
                <View style={styles.leafChoiceBox}>
                  <Text style={styles.leafChoiceText}>
                    "{currentCategory?.name}" kategorisini seçtiniz.
                  </Text>
                  <TouchableOpacity style={styles.confirmCatBtn} onPress={() => setStep(1)}>
                    <Check size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.confirmCatBtnText}>Bu Kategoriyle Devam Et</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                currentChildren.map((cat) => {
                  const IconComp = ICONS[cat.icon || cat.slug] || (!cat.parent_id ? Building2 : null);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.catItemRow}
                      onPress={() => handleSelectCategory(cat)}
                      activeOpacity={0.7}>
                      <View style={styles.catItemLeft}>
                        {IconComp && (
                          <View style={styles.iconWrap}>
                            <IconComp size={18} color="#1a4fd8" />
                          </View>
                        )}
                        <Text style={styles.catItemName}>{cat.name}</Text>
                      </View>
                      <ChevronRight size={16} color="#8a929e" />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ADIM 1: DETAY BİLGİLERİ (Title, Price, Location, Attrs)  */}
        {/* ======================================================== */}
        {step === 1 && (
          <View>
            {/* Seçilen Kategori Özeti ve Değiştir Butonu */}
            <View style={styles.selectedCatBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerPre}>SEÇİLEN KATEGORİ</Text>
                <Text style={styles.bannerCategoryText}>
                  {pathRows.map((c) => c.name).join(' → ') || currentCategory?.name}
                </Text>
              </View>
              <TouchableOpacity style={styles.changeCatBtn} onPress={() => setStep(0)}>
                <Text style={styles.changeCatBtnText}>Değiştir</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.formSectionHeader}>Temel Bilgiler</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                İlan Başlığı <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                placeholder="Örn: 2021 Model Hatasız Boyasız Megane"
                placeholderTextColor="#8a929e"
                value={title}
                onChangeText={setTitle}
                style={styles.textInput}
              />
              <Text style={styles.helperText}>En az 5 karakter girmelisiniz.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Fiyat (TL) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                placeholder="0"
                placeholderTextColor="#8a929e"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                style={styles.textInput}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Açıklama <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                placeholder="Ürününüz veya mülkünüzle ilgili detaylı bilgi verin..."
                placeholderTextColor="#8a929e"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.textInput, { height: 90, paddingTop: 8 }]}
              />
            </View>

            <Text style={styles.formSectionHeader}>Konum ve İletişim</Text>

            {/* Konum: İl / İlçe */}
            <View style={styles.fieldRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>
                  İl <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.selectorBtn}
                  onPress={() => setCityModalVisible(true)}>
                  <Text style={city ? styles.selectorValue : styles.selectorPlaceholder}>
                    {city || 'İl Seçiniz'}
                  </Text>
                  <ChevronRight size={14} color="#8a929e" />
                </TouchableOpacity>
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>İlçe</Text>
                <TouchableOpacity
                  style={styles.selectorBtn}
                  disabled={!selectedCityData}
                  onPress={() => setDistrictModalVisible(true)}>
                  <Text style={district ? styles.selectorValue : styles.selectorPlaceholder}>
                    {district || 'İlçe Seçiniz'}
                  </Text>
                  <ChevronRight size={14} color="#8a929e" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Mahalle</Text>
              <TextInput
                placeholder="Örn: Atatürk Mah."
                placeholderTextColor="#8a929e"
                value={neighborhood}
                onChangeText={setNeighborhood}
                style={styles.textInput}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>İletişim Telefonu</Text>
              <TextInput
                placeholder="05XX XXX XX XX"
                placeholderTextColor="#8a929e"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                style={styles.textInput}
              />
            </View>

            {attributesLoading ? <ActivityIndicator color={BrandColors.primary} /> : categoryAttributes.length ? (
              <View style={styles.dynamicSection}>
                <Text style={styles.dynamicHeader}>Kategori Özellikleri</Text>
                {categoryAttributes.map((attribute) => {
                  const value = attributeValues[attribute.name];
                  const options = attribute.type === 'BOOLEAN' && !attribute.options?.length ? ['Evet', 'Hayır'] : attribute.options || [];
                  const selected = String(value ?? '').split(', ').filter(Boolean);
                  return (
                    <View key={attribute.id} style={styles.fieldGroup}>
                      <Text style={styles.label}>{attribute.name}{attribute.unit ? ` (${attribute.unit})` : ''}{attribute.required ? <Text style={styles.required}> *</Text> : null}</Text>
                      {['SELECT', 'BOOLEAN', 'MULTI'].includes(attribute.type) ? (
                        <View style={styles.chipRow}>
                          {options.map((option) => {
                            const active = attribute.type === 'MULTI' ? selected.includes(option) : String(value ?? '') === option;
                            return (
                              <TouchableOpacity key={option} style={[styles.chipItem, active && styles.chipItemActive]} onPress={() => setAttributeValues((values) => {
                                if (attribute.type === 'MULTI') return { ...values, [attribute.name]: (active ? selected.filter((item) => item !== option) : [...selected, option]).join(', ') };
                                return { ...values, [attribute.name]: active ? '' : option };
                              })}>
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : (
                        <TextInput value={value == null ? '' : String(value)} onChangeText={(input) => setAttributeValues((values) => ({ ...values, [attribute.name]: attribute.type === 'NUMBER' && input ? Number(input) : input }))} keyboardType={attribute.type === 'NUMBER' ? 'numeric' : 'default'} style={styles.textInput} />
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}
            {/* İleri / Geri Butonları */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setStep(0)}>
                <Text style={styles.secondaryBtnText}>← Kategori</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleProceedToPhotos}>
                <Text style={styles.primaryBtnText}>Fotoğraflar (Devam) →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ADIM 2: FOTOĞRAF YÜKLEME (10 fotoğrafa kadar)            */}
        {/* ======================================================== */}
        {step === 2 && (
          <View>
            <View style={styles.stepHeaderRow}>
              <Text style={styles.pageTitle}>Fotoğraflar</Text>
              <View style={styles.photoCountBadge}>
                <Text style={styles.photoCountText}>{images.length}/10 Fotoğraf</Text>
              </View>
            </View>
            <Text style={styles.pageSubtitle}>
              Görseller vitrinde 4:3 oranında görünür. İlk fotoğraf ilanınızın ana vitrin kapağı olacaktır.
            </Text>

            {needsPhoto && (
              <View style={styles.warnBox}>
                <Text style={styles.warnBoxText}>
                  ⚠️ Vasıta ve emlak ilanlarında en az 1 fotoğraf yüklenmesi zorunludur.
                </Text>
              </View>
            )}

            {/* Fotoğraf Ekleme Alanı */}
            {images.length < 10 && (
              <View style={styles.photoUploadCard}>
                <View style={styles.cameraIconCircle}>
                  <Camera size={26} color="#1a4fd8" />
                </View>
                <Text style={styles.uploadPromptTitle}>Fotoğraf Çek veya Galeriden Seç</Text>
                <Text style={styles.uploadPromptSubtitle}>
                  {10 - images.length} adet daha fotoğraf ekleyebilirsiniz
                </Text>
                <View style={styles.uploadBtnsGroup}>
                  <TouchableOpacity
                    style={styles.uploadActionBtn}
                    onPress={handlePickImages}
                    activeOpacity={0.8}>
                    <ImageIcon size={16} color="#1a4fd8" style={{ marginRight: 6 }} />
                    <Text style={styles.uploadActionBtnText}>Galeriden Seç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.uploadActionBtn}
                    onPress={handleTakePhoto}
                    activeOpacity={0.8}>
                    <Camera size={16} color="#1a4fd8" style={{ marginRight: 6 }} />
                    <Text style={styles.uploadActionBtnText}>Fotoğraf Çek</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Yüklenen Fotoğraflar Grid */}
            {images.length > 0 && (
              <View style={styles.photosGrid}>
                {images.map((uri, index) => (
                  <View key={index} style={styles.photoGridItem}>
                    <Image source={{ uri }} style={styles.photoGridImg} />
                    {index === 0 ? (
                      <View style={styles.primaryCoverBadge}>
                        <Text style={styles.primaryCoverBadgeText}>Ana Kapak</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.setCoverBtn}
                        onPress={() => handleMakeCover(index)}>
                        <Text style={styles.setCoverBtnText}>Kapak Yap</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.photoDeleteBtn}
                      onPress={() => handleRemoveImage(index)}>
                      <X size={13} color="#ffffff" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* İleri / Geri Butonları */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setStep(1)}>
                <Text style={styles.secondaryBtnText}>← Detaylara Dön</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleProceedToPreview}>
                <Text style={styles.primaryBtnText}>Önizlemeye Geç →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ADIM 3: ÖNİZLEME VE YAYINLA                              */}
        {/* ======================================================== */}
        {step === 3 && (
          <View>
            <Text style={styles.pageTitle}>İlan Önizlemesi</Text>
            <Text style={styles.pageSubtitle}>
              İlanınız sitede ve uygulamada aşağıdaki gibi görünecektir. Kontrol edip yayınlayabilirsiniz.
            </Text>

            {/* Önizleme Kartı */}
            <View style={styles.previewCard}>
              {/* Kapak Görseli */}
              {images.length > 0 ? (
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: images[0] }} style={styles.previewCoverImg} />
                  <View style={styles.previewImageBadge}>
                    <Text style={styles.previewImageBadgeText}>1 / {images.length}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.previewNoImg}>
                  <ImageIcon size={36} color="#8a929e" />
                  <Text style={styles.previewNoImgText}>Fotoğraf Eklenmedi</Text>
                </View>
              )}

              {/* Ek Görseller Yatay Liste */}
              {images.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewThumbsRow}>
                  {images.slice(1).map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.previewThumbImg} />
                  ))}
                </ScrollView>
              )}

              {/* Fiyat ve Başlık */}
              <View style={styles.previewBody}>
                <Text style={styles.previewPrice}>
                  {Number(price.replace(/[^0-9]/g, '') || 0).toLocaleString('tr-TR')} TL
                </Text>
                <Text style={styles.previewTitle}>{title}</Text>

                <View style={styles.previewLocationRow}>
                  <MapPin size={14} color="#5a6270" style={{ marginRight: 4 }} />
                  <Text style={styles.previewLocationText}>
                    {city} / {district || 'Merkez'} {neighborhood ? `(${neighborhood})` : ''}
                  </Text>
                </View>

                <View style={styles.previewCategoryTag}>
                  <Text style={styles.previewCategoryTagText}>
                    {pathRows.map((c) => c.name).join(' > ') || currentCategory?.name}
                  </Text>
                </View>

                {/* Açıklama */}
                <Text style={styles.previewSectionHeader}>Açıklama</Text>
                <Text style={styles.previewDesc}>{description}</Text>

                {/* Özellikler Tablosu */}
                <Text style={styles.previewSectionHeader}>Teknik Bilgiler</Text>
                <View style={styles.specsTable}>
                  {Object.entries(attributeValues).filter(([, value]) => value !== '' && value != null).map(([name, value]) => (
                    <View key={name} style={styles.specRow}>
                      <Text style={styles.specKey}>{name}</Text>
                      <Text style={styles.specVal}>{String(value)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* İleri / Geri Butonları */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setStep(2)}>
                <Text style={styles.secondaryBtnText}>← Fotoğrafları Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, isSubmitting && { opacity: 0.7 }]}
                disabled={isSubmitting}
                onPress={handlePublish}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
            <Text style={styles.primaryBtnText}>{isEditing ? 'Değişiklikleri Kaydet' : 'Ücretsiz İlanı Yayınla'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ŞEHİR SEÇİM MODALI */}
        <Modal visible={cityModalVisible} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>İl Seçiniz</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#12151c" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchBox}>
              <Search size={16} color="#8a929e" style={{ marginRight: 6 }} />
              <TextInput
                placeholder="İl ara..."
                placeholderTextColor="#8a929e"
                value={citySearchQuery}
                onChangeText={setCitySearchQuery}
                style={styles.modalSearchInput}
              />
            </View>
            <FlatList
              data={filteredCities}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalListItem}
                  onPress={() => {
                    setCity(item.name);
                    setDistrict('');
                    setCityModalVisible(false);
                    setCitySearchQuery('');
                  }}>
                  <Text style={[styles.modalItemText, city === item.name && styles.modalItemTextActive]}>
                    {item.name}
                  </Text>
                  {city === item.name && <Check size={18} color="#1a4fd8" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>

        {/* İLÇE SEÇİM MODALI */}
        <Modal visible={districtModalVisible} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{city} - İlçe Seçiniz</Text>
              <TouchableOpacity onPress={() => setDistrictModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#12151c" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={selectedCityData?.districts || []}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalListItem}
                  onPress={() => {
                    setDistrict(item);
                    setDistrictModalVisible(false);
                  }}>
                  <Text style={[styles.modalItemText, district === item && styles.modalItemTextActive]}>
                    {item}
                  </Text>
                  {district === item && <Check size={18} color="#1a4fd8" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>
      </ScrollView>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f8', // Web: --color-bg
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#12151c',
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#5a6270',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },

  // Web Birebir Stepper Bar
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 18,
  },
  stepCol: {
    flex: 1,
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f5f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepCircleDone: {
    backgroundColor: '#1f7a4d', // Web: --color-ok
  },
  stepCircleCurrent: {
    backgroundColor: '#1a4fd8', // Web: --color-primary
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8a929e',
  },
  stepNumCurrent: {
    color: '#ffffff',
  },
  stepLabel: {
    fontSize: 11,
    color: '#8a929e',
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#12151c',
    fontWeight: '700',
  },

  // Ekmek Kırıntısı (Breadcrumb)
  breadcrumbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    padding: 10,
    marginBottom: 10,
  },
  breadcrumbLink: {
    fontSize: 12,
    color: '#1a4fd8',
    fontWeight: '600',
  },
  breadcrumbActive: {
    color: '#12151c',
    fontWeight: '700',
  },
  backBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 4,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a4fd8',
  },

  catSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 38,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  catSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#12151c',
  },

  catListBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8dee6',
    overflow: 'hidden',
    marginBottom: 16,
  },
  catItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  catItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  catItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#12151c',
  },

  leafChoiceBox: {
    padding: 24,
    alignItems: 'center',
  },
  leafChoiceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#12151c',
    marginBottom: 14,
    textAlign: 'center',
  },
  confirmCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a4fd8',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmCatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // ADIM 1: Form Stilleri
  selectedCatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    padding: 12,
    marginBottom: 16,
  },
  bannerPre: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1a4fd8',
    letterSpacing: 0.6,
  },
  bannerCategoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e1b4b',
    marginTop: 2,
  },
  changeCatBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  changeCatBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a4fd8',
  },

  formSectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#12151c',
    marginTop: 8,
    marginBottom: 8,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#12151c',
    marginBottom: 4,
  },
  required: {
    color: '#b42318',
  },
  helperText: {
    fontSize: 11,
    color: '#8a929e',
    marginTop: 2,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 40,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#12151c',
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 40,
    paddingHorizontal: 12,
  },
  selectorPlaceholder: {
    fontSize: 13,
    color: '#8a929e',
  },
  selectorValue: {
    fontSize: 13,
    color: '#12151c',
    fontWeight: '500',
  },

  dynamicSection: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8dee6',
    padding: 14,
    marginBottom: 14,
  },
  dynamicHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#12151c',
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipItem: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f3f5f8',
    borderWidth: 1,
    borderColor: '#d8dee6',
  },
  chipItemActive: {
    backgroundColor: '#1a4fd8',
    borderColor: '#1a4fd8',
  },
  chipText: {
    fontSize: 11,
    color: '#5a6270',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Buton Grubu
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#1a4fd8',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8dee6',
  },
  secondaryBtnText: {
    color: '#5a6270',
    fontSize: 12,
    fontWeight: '600',
  },

  // ADIM 2: Fotoğraf Stilleri
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoCountBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  photoCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a4fd8',
  },
  warnBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 10,
    marginBottom: 14,
  },
  warnBoxText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '500',
  },
  photoUploadCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#c7d2fe',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadPromptTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#12151c',
  },
  uploadPromptSubtitle: {
    fontSize: 11,
    color: '#8a929e',
    marginTop: 2,
    marginBottom: 14,
  },
  uploadBtnsGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a4fd8',
  },

  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  photoGridItem: {
    width: '48%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#d8dee6',
  },
  photoGridImg: {
    width: '100%',
    height: '100%',
  },
  primaryCoverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a4fd8',
    paddingVertical: 3,
    alignItems: 'center',
  },
  primaryCoverBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  setCoverBtn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(18, 21, 28, 0.75)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  setCoverBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ADIM 3: Önizleme Stilleri
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
    backgroundColor: '#f3f5f8',
  },
  previewCoverImg: {
    width: '100%',
    height: '100%',
  },
  previewImageBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewImageBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  previewNoImg: {
    width: '100%',
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f5f8',
  },
  previewNoImgText: {
    fontSize: 12,
    color: '#8a929e',
    marginTop: 6,
  },
  previewThumbsRow: {
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f5f8',
  },
  previewThumbImg: {
    width: 60,
    height: 45,
    borderRadius: 6,
    marginRight: 6,
    backgroundColor: '#f3f5f8',
  },
  previewBody: {
    padding: 16,
  },
  previewPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a4fd8',
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#12151c',
    lineHeight: 22,
    marginBottom: 8,
  },
  previewLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewLocationText: {
    fontSize: 12,
    color: '#5a6270',
  },
  previewCategoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f5f8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 14,
  },
  previewCategoryTagText: {
    fontSize: 11,
    color: '#1a4fd8',
    fontWeight: '600',
  },
  previewSectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#12151c',
    marginTop: 10,
    marginBottom: 6,
  },
  previewDesc: {
    fontSize: 12,
    color: '#5a6270',
    lineHeight: 18,
    marginBottom: 10,
  },
  specsTable: {
    borderTopWidth: 1,
    borderTopColor: '#f3f5f8',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f5f8',
  },
  specKey: {
    fontSize: 12,
    color: '#8a929e',
  },
  specVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#12151c',
  },

  // Modal Stilleri
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#12151c',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f5f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 40,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#12151c',
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  modalItemText: {
    fontSize: 14,
    color: '#12151c',
  },
  modalItemTextActive: {
    color: '#1a4fd8',
    fontWeight: '700',
  },
});
