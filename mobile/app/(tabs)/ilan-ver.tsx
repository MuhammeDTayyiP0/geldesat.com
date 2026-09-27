import React, { useState, useMemo } from 'react';
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
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { BrandColors } from '@/constants/Colors';
import { EMBEDDED_CATEGORIES, CategoryItem } from '@/src/data/categoriesData';
import { TURKEY_CITIES } from '@/src/data/locations';

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

const FUEL_TYPES = ['Benzin', 'Dizel', 'Hibrit', 'Elektrik', 'LPG'];
const GEAR_TYPES = ['Otomatik', 'Manuel', 'Yarı Otomatik'];
const ROOM_TYPES = ['1+0 (Stüdyo)', '1+1', '2+1', '3+1', '4+1', '5+1', 'Dubleks'];
const HEATING_TYPES = ['Doğalgaz (Kombi)', 'Merkezi', 'Yerden Isıtma', 'Klima', 'Soba', 'Yok'];

export default function PostAdScreen() {
  const [step, setStep] = useState<1 | 2>(1); // 1: Kategori Seçimi, 2: İlan Formu
  const [path, setPath] = useState<string[]>([]); // Category ID array
  const [catSearch, setCatSearch] = useState('');

  // Form Verileri
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');

  // Dinamik Alanlar
  const [year, setYear] = useState('');
  const [km, setKm] = useState('');
  const [fuel, setFuel] = useState('');
  const [gear, setGear] = useState('');
  const [m2Net, setM2Net] = useState('');
  const [m2Brut, setM2Brut] = useState('');
  const [rooms, setRooms] = useState('');
  const [heating, setHeating] = useState('');
  const [furnished, setFurnished] = useState<'Evet' | 'Hayır' | ''>('');

  // Şehir / İlçe Seçim Modalları
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kategori Ağacı Hesaplamaları
  const selectedCatId = path[path.length - 1] || null;

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

  // Şehir ve İlçe Verileri
  const selectedCityData = useMemo(() => {
    return TURKEY_CITIES.find((c) => c.name === city);
  }, [city]);

  const filteredCities = useMemo(() => {
    if (!citySearchQuery.trim()) return TURKEY_CITIES;
    const q = citySearchQuery.trim().toLowerCase();
    return TURKEY_CITIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [citySearchQuery]);

  // Kategori Seçim İşlemleri
  const handleSelectCategory = (cat: CategoryItem) => {
    const nextPath = [...path, cat.id];
    setPath(nextPath);
    setCatSearch('');

    // Bu kategorinin alt kategorisi var mı kontrol et
    const hasChildren = EMBEDDED_CATEGORIES.some((c) => c.parent_id === cat.id);
    if (!hasChildren) {
      // Yaprak kategoriye ulaşıldı, forma geç
      setStep(2);
    }
  };

  const handleBackCategory = () => {
    if (path.length > 0) {
      setPath(path.slice(0, -1));
      setCatSearch('');
    }
  };

  // Kamera
  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Fotoğraf çekebilmek için kamera izni vermelisiniz.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  // Galeri
  const handlePickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Fotoğraf yükleyebilmek için galeri izni vermelisiniz.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = () => {
    if (!title.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen ilan başlığı giriniz.');
      return;
    }
    if (!price.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen fiyat giriniz.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen il seçiniz.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert('Tebrikler!', 'İlanınız ücretsiz olarak başarıyla yayınlandı.', [
        {
          text: 'Tamam',
          onPress: () => {
            setStep(1);
            setPath([]);
            setTitle('');
            setPrice('');
            setCity('');
            setDistrict('');
            setNeighborhood('');
            setPhone('');
            setDescription('');
            setImages([]);
            setYear('');
            setKm('');
            setFuel('');
            setGear('');
            setM2Net('');
            setM2Brut('');
            setRooms('');
            setHeating('');
            setFurnished('');
          },
        },
      ]);
    }, 1200);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* ======================================================== */}
      {/* ADIM 1: SİTE İLE BİREBİR KATEGORİ SEÇİMİ                 */}
      {/* ======================================================== */}
      {step === 1 ? (
        <View>
          <Text style={styles.pageTitle}>Adım 1: Kategori Seçin</Text>
          <Text style={styles.pageSubtitle}>İlanınızın doğru kategoride yayınlanması için adımları takip edin.</Text>

          {/* Ekmek Kırıntısı (Breadcrumb) */}
          {path.length > 0 && (
            <View style={styles.breadcrumbCard}>
              <TouchableOpacity onPress={() => setPath([])}>
                <Text style={styles.breadcrumbLink}>Kategoriler</Text>
              </TouchableOpacity>
              {pathRows.map((cat, idx) => (
                <React.Fragment key={cat.id}>
                  <ChevronRight size={12} color="#8a929e" style={{ marginHorizontal: 2 }} />
                  <TouchableOpacity
                    onPress={() => setPath(path.slice(0, idx + 1))}
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
              <Text style={styles.backBtnText}>Bir Üst Seviyeye Dön</Text>
            </TouchableOpacity>
          )}

          {/* Arama Kutusu */}
          {currentChildren.length > 5 && (
            <View style={styles.catSearchBox}>
              <Search size={15} color="#8a929e" style={{ marginRight: 6 }} />
              <TextInput
                placeholder="Kategori veya marka ara..."
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
                <TouchableOpacity style={styles.confirmCatBtn} onPress={() => setStep(2)}>
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

          {/* Doğrudan Seçili Kategoriyle Devam Et Butonu (Eğer kök değilse) */}
          {currentCategory && currentChildren.length > 0 && (
            <TouchableOpacity style={styles.continueDirectBtn} onPress={() => setStep(2)}>
              <Text style={styles.continueDirectText}>
                "{currentCategory.name}" genel kategorisiyle devam et →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* ======================================================== */
        /* ADIM 2: SİTE İLE BİREBİR İLAN BİLGİLERİ FORMU            */
        /* ======================================================== */
        <View>
          {/* Seçilen Kategori Özeti ve Değiştir Butonu */}
          <View style={styles.selectedCatBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerPre}>SEÇİLEN KATEGORİ</Text>
              <Text style={styles.bannerCategoryText}>
                {pathRows.map((c) => c.name).join(' > ') || currentCategory?.name}
              </Text>
            </View>
            <TouchableOpacity style={styles.changeCatBtn} onPress={() => setStep(1)}>
              <Text style={styles.changeCatBtnText}>Değiştir</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.formSectionHeader}>Fotoğraflar</Text>
          <Text style={styles.formSectionSubtitle}>
            İlk yüklediğiniz fotoğraf vitrinde kapak fotoğrafı olarak görünür (En fazla 10 adet).
          </Text>

          {/* Fotoğraf Butonları */}
          <View style={styles.photoActionsRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={handlePickImages} activeOpacity={0.8}>
              <ImageIcon size={18} color="#1a4fd8" style={{ marginRight: 6 }} />
              <Text style={styles.photoBtnText}>Galeriden Seç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto} activeOpacity={0.8}>
              <Camera size={18} color="#1a4fd8" style={{ marginRight: 6 }} />
              <Text style={styles.photoBtnText}>Fotoğraf Çek</Text>
            </TouchableOpacity>
          </View>

          {/* Fotoğraf Listesi */}
          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {images.map((uri, index) => (
                <View key={index} style={styles.thumbWrapper}>
                  <Image source={{ uri }} style={styles.thumbImg} />
                  {index === 0 && (
                    <View style={styles.coverBadge}>
                      <Text style={styles.coverBadgeText}>Kapak</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeImgBtn} onPress={() => handleRemoveImage(index)}>
                    <X size={12} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Temel Bilgiler Formu */}
          <Text style={styles.formSectionHeader}>İlan Detayları</Text>

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
            <Text style={styles.label}>Telefon Numarası</Text>
            <TextInput
              placeholder="05XX XXX XX XX"
              placeholderTextColor="#8a929e"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.textInput}
            />
          </View>

          {/* Kategoriye Özel Dinamik Alanlar: Vasıta */}
          {isVehicle && (
            <View style={styles.dynamicSection}>
              <Text style={styles.dynamicHeader}>Vasıta Özellikleri</Text>
              <View style={styles.fieldRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Model Yılı</Text>
                  <TextInput
                    placeholder="2020"
                    placeholderTextColor="#8a929e"
                    value={year}
                    onChangeText={setYear}
                    keyboardType="numeric"
                    style={styles.textInput}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Kilometre (KM)</Text>
                  <TextInput
                    placeholder="75000"
                    placeholderTextColor="#8a929e"
                    value={km}
                    onChangeText={setKm}
                    keyboardType="numeric"
                    style={styles.textInput}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Yakıt Tipi</Text>
                <View style={styles.chipRow}>
                  {FUEL_TYPES.map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.chipItem, fuel === f && styles.chipItemActive]}
                      onPress={() => setFuel(f)}>
                      <Text style={[styles.chipText, fuel === f && styles.chipTextActive]}>
                        {f}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Vites Tipi</Text>
                <View style={styles.chipRow}>
                  {GEAR_TYPES.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.chipItem, gear === g && styles.chipItemActive]}
                      onPress={() => setGear(g)}>
                      <Text style={[styles.chipText, gear === g && styles.chipTextActive]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Kategoriye Özel Dinamik Alanlar: Emlak */}
          {isProperty && (
            <View style={styles.dynamicSection}>
              <Text style={styles.dynamicHeader}>Emlak Özellikleri</Text>
              <View style={styles.fieldRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>m² (Net)</Text>
                  <TextInput
                    placeholder="120"
                    placeholderTextColor="#8a929e"
                    value={m2Net}
                    onChangeText={setM2Net}
                    keyboardType="numeric"
                    style={styles.textInput}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>m² (Brüt)</Text>
                  <TextInput
                    placeholder="135"
                    placeholderTextColor="#8a929e"
                    value={m2Brut}
                    onChangeText={setM2Brut}
                    keyboardType="numeric"
                    style={styles.textInput}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Oda Sayısı</Text>
                <View style={styles.chipRow}>
                  {ROOM_TYPES.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.chipItem, rooms === r && styles.chipItemActive]}
                      onPress={() => setRooms(r)}>
                      <Text style={[styles.chipText, rooms === r && styles.chipTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Isıtma</Text>
                <View style={styles.chipRow}>
                  {HEATING_TYPES.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.chipItem, heating === h && styles.chipItemActive]}
                      onPress={() => setHeating(h)}>
                      <Text style={[styles.chipText, heating === h && styles.chipTextActive]}>
                        {h}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Açıklama */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>İlan Açıklaması</Text>
            <TextInput
              placeholder="Ürününüz veya mülkünüzle ilgili detayları yazın..."
              placeholderTextColor="#8a929e"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={[styles.textInput, { height: 100, paddingTop: 10 }]}
            />
          </View>

          {/* Yayınla Butonu */}
          <TouchableOpacity
            style={styles.publishBtn}
            onPress={handlePublish}
            disabled={isSubmitting}
            activeOpacity={0.85}>
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.publishBtnText}>Ücretsiz İlanı Yayınla</Text>
            )}
          </TouchableOpacity>
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
  },

  // Ekmek Kırıntısı
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
    padding: 20,
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
  continueDirectBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  continueDirectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a4fd8',
  },

  // ADIM 2: Form Stilleri
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
    fontSize: 15,
    fontWeight: '700',
    color: '#12151c',
    marginTop: 12,
    marginBottom: 4,
  },
  formSectionSubtitle: {
    fontSize: 11,
    color: '#5a6270',
    marginBottom: 10,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 42,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#12151c',
  },
  imagesScroll: {
    marginBottom: 16,
  },
  thumbWrapper: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    position: 'relative',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 79, 216, 0.85)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  coverBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  removeImgBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 5,
  },
  required: {
    color: '#b42318',
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
    fontSize: 14,
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

  publishBtn: {
    backgroundColor: '#1a4fd8',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#1a4fd8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  publishBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Modal
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
