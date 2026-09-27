# geldesat.com — Kurumsal Mobil Uygulama (iOS & Android) Mimari ve Yol Haritası

> 📌 **CANLI GELİŞTİRME DURUMU (STATE TRACKER)**  
> **Son Güncelleme:** 2026-09-27  
> **Mevcut Aşama:** 🚀 **TÜM MOBİL KODLAMA, GİRİŞ SİSTEMİ, BİLDİRİMLER VE MAĞAZA VARLIKLARI TAMAMLANDI — SADECE RESMİ YAYIN (FAZ 5.3) KALDI**  
> **Tamamlananlar:**  
> • Mobil Oturum Sistemi (`/login`, `expo-secure-store`, `src/api/auth.ts`) & Profil entegrasyonu tamamlandı.  
> • Sitedeki PostgreSQL veritabanından 864 adet gerçek kök, marka ve alt kategori mobil içine gömüldü (`categoriesData.ts`).  
> • Web sitesindeki 10 ana kök kategori ve web ile aynı ikonlar entegre edildi.  
> • Tüm demo/sahte ilanlar tamamen kaldırıldı; sitedeki birebir boş vitrin durumu ("Henüz vitrin ilanı yok. İlk ilanı siz verin") uygulandı.  
> • Kategori ağacında kademeli gezinti (Breadcrumb: `Vasıta > Otomobil > Markalar`) ve arama eklendi.  
> • İlan Ver ekranında hiyerarşik kategori seçimi, 81 il ve ilçe seçimi, dinamik vasıta/emlak özellikleri ve fotoğraf yükleme tamamlandı.  
> • Anlık Bildirimler (`src/services/notifications.ts`, `expo-notifications`) ve Deep Linking (`geldesat://ilan/[id]`, Android Intent Filters, iOS Universal Links) bağlandı.  
> • 1024x1024 Resmi GeldeSat Uygulama İkonu (`icon.png`, `android-icon-foreground.png`) ve Splash ekranı oluşturuldu.  
> • Mobil ve Web projeleri 0 TypeScript hatasıyla tam derlendi.  
> *(Yeni sohbete geçildiğinde: Sadece "Yol haritasına bakıp kaldığımız yerden devam edelim" yazmanız yeterlidir; yapay zeka bu bloğu ve aşağıdaki [x] işaretlerini okuyarak kaldığı yeri saniyesinde hatırlar.)*

---

## 1. Mimari Vizyon ve Temel Kurallar

1. **%100 Saf Native Performans (WebView Değildir):**
   * Arayüz, iOS'ta Apple'ın UIKit/Swift (`UICollectionView`), Android'de Google'ın (`RecyclerView`) saf native bileşenlerine derlenir. 120Hz ekranlarda takılmasız, yağ gibi akan bir kaydırma deneyimi sunar.
2. **Sıfır Veri / Arka Plan Kaybı:**
   * Mevcut PostgreSQL veritabanı, Prisma şeması, araç katalogları, kategoriler, kullanıcı hesapları ve ilanlar tamamen ortaktır.
   * Web sitesi ile mobil uygulama eşzamanlı çalışır (Web'den eklenen ilan mobilde, mobilde favorilenen ilan web'de anında güncellenir).
3. **Üçüncü Taraf Bağımsızlığı (Sıfır Ek Maliyet & Tam Veri Gizliliği):**
   * PostHog, Firebase Remote Config gibi dış servislere ihtiyaç yoktur.
   * Projede zaten var olan `app_config` veritabanı tablosu ve `calculateVariant` yerel hash motoru ile A/B testleri ve vitrin sıralaması 0 TL maliyetle kendi sunucumuzda çalışır.
4. **GitHub Üzerinden Otomatik Bulut Derleme (CI/CD):**
   * Bilgisayarınızda karmaşık Mac/Xcode veya Android Studio kurulumları gerekmez.
   * Kodu GitHub'a gönderdiğiniz anda bulut sunucuları (EAS Build) otomatik olarak Android `.apk`/`.aab` ve iOS `.ipa` derler; telefonunuza tek tıkla/QR kodla kurabileceğiniz indirme linkini üretir.
5. **Güncellemesiz Dinamik Yönetim:**
   * **Server-Driven UI (SDUI):** Ana sayfa vitrin sırası ve kampanya blokları `app_config` tablosundan anlık yönetilir.
   * **Yerel A/B Testi:** Deterministik hash motoru ile arayüz varyasyonları kullanıcılara bölünerek test edilir.
   * **OTA (Over-The-Air) Updates:** Tasarım ve kod değişiklikleri Apple/Google onayına girmeden kullanıcılara anında gönderilir.

---

## 2. Teknoloji Yığını (Tech Stack)

| Katman | Teknoloji / Kütüphane | Ne İşe Yarar? |
| :--- | :--- | :--- |
| **Çekirdek Çerçeve** | React Native (Expo SDK - New Architecture) | Fabric render motoru ve TurboModules ile Instagram kalitesinde saf native performans. |
| **Derleme & Dağıtım** | GitHub + Expo EAS Build | Windows üzerinden tek satır kod yazmadan bulutta iOS (.ipa) ve Android (.apk/.aab) derleme. |
| **Liste Performansı** | Shopify FlashList | 10.000 ilan olsa dahi bellek şişmesi olmadan 120 FPS akıcı sonsuz kaydırma (Cell Recycling). |
| **Görsel Önbellek** | Expo Image | Disk + RAM LRU cache. İlan fotoğrafları bir kez indirilir, sonraki açılışlarda anında gelir. |
| **Tasarım Sistemi** | NativeWind (Tailwind CSS) | Web'deki renkler, butonlar ve tipografinin mobilde birebir görsel kayıpsız korunması. |
| **Veri & Durum Yönetimi** | TanStack Query v5 + Zustand | Otomatik veri önbellekleme, arka plan senkronizasyonu ve global durum yönetimi. |
| **Lokal Depolama** | MMKV (C++ Tabanlı) | AsyncStorage'a göre 30 kat hızlı cihaz içi depolama (oturum, sepet, son aramalar). |
| **Kamera & Görsel İşleme** | Expo Camera & ImageManipulator | İlan verirken telefonda otomatik görsel sıkıştırma (50MB fotoğrafları 3MB'a düşürerek hızlı yükleme). |
| **Yerel A/B Testi & SDUI** | `app_config` + `calculateVariant` | Projede kurulu olan 0 TL maliyetli, tamamen kendi sunucumuzda çalışan yerel vitrin ve test motoru. |
| **Canlı Kod Basma** | EAS Update (OTA) | App Store onayını beklemeden tek komutla canlı arayüz güncellemesi iletme. |
| **Bildirim & Derin Bağlantı** | OneSignal / FCM + Expo Linking | Fiyatı düşen ilan bildirimleri ve WhatsApp'tan paylaşılan ilanın direkt uygulamada açılması. |

---

## 3. Sahibinden & Instagram Mimarisi Nasıl İşler?

```
┌────────────────────────────────────────────────────────┐
│                   KULLANICI ARAYÜZÜ                    │
│   NativeWind (Tailwind) + Lucide Icons + Haptics       │
├────────────────────────────────────────────────────────┤
│                   PERFORMANS MOTORLARI                 │
│  • Shopify FlashList (120 FPS İlan Akışı)              │
│  • Expo Image (RAM + Disk LRU Önbellek)                │
│  • Reanimated (Akıcı 60 FPS Geçişler ve Gestures)      │
├────────────────────────────────────────────────────────┤
│                   VERİ & DURUM KATMANI                 │
│  • TanStack Query (Sunucu Cache & Infinite Scroll)     │
│  • Zustand & MMKV (Süper Hızlı Cihaz İçi Depolama)     │
├────────────────────────────────────────────────────────┤
│                   YEREL TEST & DİNAMİK YÖNETİM         │
│  • app_config Tablosu (Server-Driven Vitrin Yönetimi)  │
│  • calculateVariant() (0 TL Yerel A/B Test Motoru)     │
├────────────────────────────────────────────────────────┤
│                   BULUT & MAĞAZA DAĞITIMI              │
│  • GitHub Push -> EAS Build Cloud (iOS & Android)      │
│  • EAS Update (Mağazasız Canlı Kod Dağıtımı)           │
└────────────────────────────────────────────────────────┘
```

---

## 4. Detaylı Fazlar ve İş Planı

### FAZ 1: Mobil Proje İskeleti ve Navigasyon
- [x] **1.1 Expo Kurulumu:** En güncel Expo SDK ve New Architecture aktif edilerek mobil projenin başlatılması (`/mobile` klasörü) — TAMAMLANDI.
- [x] **1.2 Tasarım Eşlemesi:** `geldesat.com` renk paleti, tipografi, buton ve rozet (ACİL, ÖNE ÇIKAN) stillerinin aktarılması — TAMAMLANDI.
- [x] **1.3 Sahibinden Tarzı Tab Bar (Alt Menü):**
  - 🏠 **Vitrin / Keşfet:** Instagram/Sahibinden tarzı dinamik ilan akışı (`index.tsx`) — TAMAMLANDI.
  - 📂 **Kategoriler:** Hiyerarşik kategori ağacı (`kategoriler.tsx`) — TAMAMLANDI.
  - ➕ **İlan Ver:** Ortada büyük, dikkat çeken aksiyon butonu (`ilan-ver.tsx`) — TAMAMLANDI.
  - 💬 **Mesajlar:** Alıcı-satıcı anlık mesajlaşma ekranı (`mesajlar.tsx`) — TAMAMLANDI.
  - 👤 **Hesabım:** İlanlarım, favorilerim, profil ve ayarlar (`profil.tsx`) — TAMAMLANDI.

---

### FAZ 2: Backend ve API Köprüsünün Kurulması
- [x] **2.1 API Standardizasyonu:** Web tarafında `/api/mobile/listings`, `/api/mobile/categories` REST JSON çıktıları bağlandı — TAMAMLANDI.
- [x] **2.2 Yerel Config & A/B Bağlantısı:** `/api/mobile/config` rotası ve `calculateVariant` yerel A/B testi bağlandı — TAMAMLANDI.
- [x] **2.3 Oturum Yönetimi (Auth):**
  - Güvenli Keychain/Keystore token altyapısı (`expo-secure-store`, `src/api/auth.ts`) — TAMAMLANDI.
  - Mobil Giriş & Kayıt Ekranı (`/login`) ve Profil entegrasyonu — TAMAMLANDI.
- [x] **2.4 TanStack Query Entegrasyonu:** Mobil istemcide `QueryClientProvider` ve `src/api/client.ts` kuruldu — TAMAMLANDI.

---

### FAZ 3: Arayüz ve Web Bileşenlerinin Birebir Native Dönüşümü
- [x] **3.1 `ListingCard` (İlan Kartı):**
  - Web'deki kart tasarımı: Görsel, "ACİL", "ÖNE ÇIKAN" rozetleri, fiyat, konum, tarih ve kalp (favori) butonu.
  - Grid (2'li ızgara) ve List (Sahibinden modeli tekil) varyantları kodlandı — TAMAMLANDI.
- [x] **3.2 Dinamik Kategori & Özellik Filtreleme:**
  - Acil ilan anahtarı, Şehir, Fiyat Min/Max, Yıl Min/Max, Yakıt ve Vites filtreleri (`FilterModal.tsx`) — TAMAMLANDI.
- [x] **3.3 `ListingDetail` & Galeri:**
  - Tam ekran kaydırılabilir yüksek çözünürlüklü görsel galerisi (`ListingImageGallery`) — TAMAMLANDI.
  - Araç ve ürün teknik detay tablosu — TAMAMLANDI.
  - Sabit alt iletişim barı (`StickyContactBar`): "Satıcıyı Ara", "WhatsApp/Mesaj" ve "Favori" butonları — TAMAMLANDI.
- [x] **3.4 Hızlı İlan Verme & Kamera Entegrasyonu:**
  - Telefon kamerası ve galerisinden çoklu fotoğraf seçimi (`expo-image-picker`) — TAMAMLANDI.
  - Form alanları, kapak fotoğrafı seçimi ve görsel optimizasyonu — TAMAMLANDI.

---

### FAZ 4: Yerel A/B Testi, SDUI ve Canlı Güncellemeler
- [x] **4.1 Server-Driven UI (Dinamik Vitrin):**
  - `/api/mobile/config` ve `app_config.home_sections` üzerinden dinamik vitrin yönetimi — TAMAMLANDI.
- [x] **4.2 Sıfır Maliyetli Yerel A/B Testi:**
  - Projedeki `calculateVariant` algoritması ile `listing_card_layout` (Grid vs List) A/B testi mobil vitrinde aktif — TAMAMLANDI.
- [x] **4.3 Canlı OTA Güncellemeleri (EAS Update):**
  - Mağaza onayı olmadan anında arayüz ve mantık güncellemesi basabilen CI/CD kanalları (`eas.json`) — TAMAMLANDI.
- [x] **4.4 Anlık Bildirimler (Push Notifications):**
  - Push notification servisi (`src/services/notifications.ts`, `expo-notifications`, Android kanalları) — TAMAMLANDI.
- [x] **4.5 Deep Linking (Evrensel Bağlantılar):**
  - `geldesat://ilan/[id]` şeması ve Android `intentFilters` ile iOS `associatedDomains` (`app.json`) — TAMAMLANDI.

---

### FAZ 5: GitHub Bulut Derleme (CI/CD) ve Mağaza Yayını
- [x] **5.1 EAS Build Kurulumu (`eas.json`):**
  - Android için doğrudan kurulabilir test `.apk` ve Google Play için `.aab` profilleri — TAMAMLANDI.
  - iOS için Apple TestFlight ve App Store `.ipa` profilleri — TAMAMLANDI.
  - Kurumsal paket kimliği (`com.geldesat.app`) ve kamera/galeri izinleri (`app.json`) — TAMAMLANDI.
- [x] **5.2 Mağaza Varlıkları:**
  - 1024x1024 Resmi GeldeSat Uygulama İkonu (`icon.png`, `android-icon-foreground.png`) — TAMAMLANDI.
  - Açılış (Splash) ekranı (`splash-icon.png`) — TAMAMLANDI.
- [ ] **5.3 Resmi Yayın:**
  - Apple Developer Hesabı ile TestFlight ve App Store yayını.
  - Google Play Console ile Dahili Test ve Canlı Yayın.

---

## 5. Projedeki Yerel Sistem Nasıl Çalışır?

### A. Server-Driven UI (Vitrin Yönetimi)
Veritabanındaki `app_config` tablosunda:
```json
// key: 'home_sections'
["hero", "categories", "featured", "recent", "stats"]
```
Mobil uygulama açıldığında bu sırayı okur ve ana sayfayı anında bu sıraya göre üzerindeki bileşenlerle (`HeroSlider`, `CategoryList`, `FeaturedFeed`, `RecentFeed`) çizer. Sırayı değiştirmek 1 saniye sürer, hiçbir mağaza güncellemesi gerektirmez.

### B. Yerel A/B Testi Motoru (`calculateVariant`)
Mevcut kodunuzdaki hashleme mantığı:
```ts
// Kullanıcının ID'si ve test adı matematiksel olarak hash'lenir (3. parti araç gerekmez)
const variant = calculateVariant("ilan_karti_testi", user.id, ["A", "B"]);

if (variant === "B") {
  return <ListingCardVariantB listing={item} />;
}
return <ListingCardVariantA listing={item} />;
```

---

## 6. GitHub Bulut Derleme Akışı

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. GÜNLÜK GELİŞTİRME                                        │
│ • Bilgisayarda Expo çalışır.                                │
│ • Telefonda "Expo Go" ile QR kod okutulur.                   │
│ • Kod değişiklikleri 1 saniyede ekranda güncellenir.        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. GITHUB'A PUSH (git push origin main)                     │
│ • Kodlar GitHub'a iletilir.                                 │
│ • EAS Build bulut sunucuları otomatik tetiklenir:           │
│   - Linux sunucu -> Android APK derler.                     │
│   - Mac sunucu   -> iOS IPA derler.                         │
│ • Size QR kodlu indirme linki üretilir (Telefona hemen kur).│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. MAĞAZAYA ÇIKIŞ & CANLI GÜNCELLEME                        │
│ • Tek komutla Apple TestFlight ve Google Play'e gönderilir. │
│ • Tasarım yenilikleri için mağaza onayı beklenmez:          │
│   'eas update' ile anında kullanıcılara canlı yansıtılır.   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Önerilen Mobil Proje Klasör Yapısı

```text
geldesat.com/
├── mobile/                  # Mobil Uygulama Kök Dizini
│   ├── assets/              # İkonlar, splash ekranı, fontlar
│   ├── src/
│   │   ├── api/             # Web backend'i ile haberleşen API servisleri
│   │   ├── components/
│   │   │   ├── common/      # Butonlar, inputlar, badge'ler, modal'lar
│   │   │   ├── listing/     # ListingCard, ImageGallery, ContactBar
│   │   │   └── sdui/        # Server-Driven UI dinamik vitrin motoru
│   │   ├── hooks/           # useAuth, useFavorites, useListings, useABTest
│   │   ├── navigation/      # TabBar ve Ekran Yönlendirmeleri (Expo Router)
│   │   ├── screens/         # Vitrin, Kategori, İlan Detay, İlan Ver, Profil
│   │   ├── store/           # Zustand & MMKV lokal durum yönetimi
│   │   └── types/           # Web'den paylaşılan ortak TypeScript tipleri
│   ├── app.json             # Expo proje ve mağaza konfigürasyonu
│   ├── eas.json             # GitHub bulut derleme ve profil ayarları
│   └── package.json         # Mobil bağımlılıklar
```

---

*Bu belge, mobil geliştirme süreci boyunca tek başvuru kaynağı (Single Source of Truth) olarak güncellenecektir.*
