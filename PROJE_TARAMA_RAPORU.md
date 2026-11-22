# GeldeSat Kapsamlı Proje Tarama Raporu (Kalan Açık Maddeler)

**Güncelleme:** 22 Kasım 2026 (`b4372f3` sonrası kalan açıklar)  
**Kapsam:** `web/` (TanStack Start + PostgreSQL), `mobile-app/` (Expo SDK 58 / React Native), Admin Paneli, SEO/DevOps ve Pazar Yeri Ürün Deneyimi.

> [!NOTE]
> `b4372f3` ile çözülen acil kırıklar (KVKK `verilerim.ts` SQL hatası, admin `approve`/`activate`, mobil `favorites` çıkarma, `/sayfa/yardim` 404, Better Auth `pg.Pool` hata dinleyicisi, `/api/geo` kuyruk kilidi, `ota.ts` host sabitleme, `migrate.mjs` advisory lock, web `DropdownMenu`/`Dialog` token + `.site-header` `z-index`, mobil `FilterSheet` iç içe Modal, Android `Sheet` klavye, sohbet `SwipeToReply`/`jumpTo`/`online` noktası, `sitemap-categories.xml` üst kategoriler, JSON-LD ve 4 kalıcı özellik anahtarı) rapordan çıkarılmıştır. Bu dosya **yalnızca hâlâ açık olan işleri** içerir.

---

## 1. Güvenlik, Sunucu Kararlılığı ve Veri Bütünlüğü

| Öncelik | Sorun | Konum | Etki & Çözüm |
|---|---|---|---|
| **YÜKSEK** | **HEIC çözümleme boyut kontrolünden önce ana thread'i kilitliyor** | [image-pipeline.server.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/image-pipeline.server.ts#L129-L142) | `heic-decode` (WASM) tüm piksel tamponunu açtıktan sonra `MAX_INPUT_PIXELS` kontrolü yapılıyor; büyük boyutlu hazırlanmış bir HEIC dosyası tek Node event loop'unu dondurup belleği tüketebilir. |
| **YÜKSEK** | **OTA yayın ucunda boyut/hız sınırı yok & paketler imzasız** | [ota.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/ota.ts#L51-L58), [assets.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/ota/publish/assets.ts#L31) | `/api/ota/publish/*` için brute-force hız sınırı, `limitedFormData()` gövde limiti ve Expo Updates RSA kod imzası eksik. |
| **YÜKSEK** | **Kimliksiz `client_errors` yazma taşması** | [client-errors.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/client-errors.ts#L28-L46) | Global yazma kotası ve `(update_id, platform, message, screen)` tekilleştirmesi yok; 30 gün saklanan hata tablosu şişirilebilir. |
| **YÜKSEK** | **`TRUSTED_IP_HEADER` edilmemiş ortamda `X-Forwarded-For` zafiyeti** | [helpers.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/helpers.ts#L439-L447) | `x-real-ip` önceliklendirildi ancak proxy `x-real-ip` göndermiyorsa ve `TRUSTED_IP_HEADER` Coolify'da tanımlı değilse `x-forwarded-for` ilk değeri hâlâ sahtelenebilir. |
| **ORTA** | **Mobil OAuth `Secure` çerezi reverse proxy arkasında düşüyor** | [start.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/oauth/start.ts#L24), [done.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/oauth/done.ts#L17-L20) | `url.protocol === "https:"` proxy arkasında `http:` olur → `gs-oauth-challenge` `Secure` olmadan gider ve `/done` sonrası temizlenmez. |
| **ORTA** | **Google-only admin rol değişiminde yeniden doğrulamayı atlıyor** | [admin/users.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/users.ts#L248-L260) | Şifresi olmayan Google yöneticisi, 60 günlük oturumla tazelik kontrolü olmadan başka kullanıcıyı `ADMIN` yapabiliyor. |
| **ORTA** | **İnceleme uygunluğu (`checkReviewEligibility`) tekillik kuralıyla çelişiyor** | [social.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/social.ts#L138-L143) | DB satıcı+yorumcu başına tek puan tutuyor ama web sorgusu hâlâ `listing_id` ile filtreliyor; aynı satıcının başka ilanında eski yorum gizlenip sessizce üzerine yazılıyor. |
| **ORTA** | **Kategori slug güncellemesi çakışma kontrolünden önce `category_old_slugs` tablosunu bozuyor** | [admin/categories.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/categories.ts#L274-L281) | Transaction yok ve slug çakışınca eski yönlendirme kayıtları bozulmuş hâlde kalıyor. |
| **ORTA** | **Çerez kabul eden `/api/mobile/*` POST uçlarında CSRF / `Content-Type` kontrolü eksik** | [rpc/$fn.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/rpc/$fn.ts#L117-L128), [notifications.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/notifications.ts#L31) | `Authorization: Bearer` yanında tarayıcı çerezini de kabul eden mobil uçlar `Content-Type: application/json` veya `Sec-Fetch-Site` denetlemiyor (`notifications.ts`'de gövde limiti de yok). |
| **ORTA** | **Silinme sürecindeki hesap mesaj göndermeye devam edebiliyor** | [chat.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/chat.ts#L67-L70) | `assertCanMessage` yalnızca alıcıyı (`to`) kontrol ediyor, göndericiyi (`from`) kontrol etmiyor. |
| **ORTA** | **Cron + trafik bazlı süpürme çakışması & başarısız e-posta kaybı** | [message-digest.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/message-digest.ts#L66-L84), [ops.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/ops.ts#L6-L31) | Kilit olmadığı için eşzamanlı çalışma mükerrer bildirim/e-posta atabilir; `last_message_email_at` SMTP gönderiminden **önce** yazıldığı için SMTP kesintisinde özet e-postaları kalıcı olarak atlanır. |
| **ORTA** | **Çok adımlı yazma işlemlerinde eksik transaction'lar** | [admin/users.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/users.ts#L449-L456), [chat.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/chat.ts#L105-L233), [avatar.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/avatar.ts#L32-L54) | Kredi düşme yarışı, chat fotoğrafı sahipsiz blob kalması ve paralel teklif yarışı riski. |

---

## 2. Tasarım, Arayüz (UI) ve Deneyim (UX) Eksikleri

### 2.1 Web Arayüzü & Tasarım
- **Kalan katman & bileşen pürüzleri:**
  - `mobile-content-space` [__root.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/__root.tsx#L154)'te `<Footer />` yerine `<main>` üzerinde; mobilde footer'ın üstünde boşluk, altında ise `BottomNav` tarafından örtülen telif satırı oluşuyor.
  - [CookieBanner.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/layout/CookieBanner.tsx#L27-L28) ve [search.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/search.tsx#L616) yüzen çubukları mobilde `BottomNav`'ın ortadaki çıkıntılı "İlan Ver" FAB'ıyla çakışabiliyor; `CookieBanner` footer altında boş şerit bırakıyor.
  - [sayfa/$slug.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/sayfa/$slug.tsx#L126) içindeki `top-24` yapışkan offset'i 108px navbar'a göre `top-28` olmalı.
  - `ui/` altındaki diğer kullanılmayan veya az kullanılan shadcn dosyalarında (`select.tsx`, `popover.tsx`, `alert.tsx`, `card.tsx`, `textarea.tsx`, `alert-dialog.tsx`, `slider.tsx`) hâlâ tanımsız `bg-background`/`bg-popover`/`text-muted-foreground` sınıfları duruyor.
  - `buttonVariants` üzerine `inline-block` verilen diğer yerler ([doping.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/doping.tsx#L22), [ayarlar/magaza.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ayarlar/magaza.tsx#L110)).
- **Karanlık tema pürüzleri:**
  - Ana sayfa kategori şeridi ([index.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/index.tsx#L188)) açık tema hex tonlarını (`#475467`, `#1a4fd8`) koyu arka planda kullanıyor (~2.1:1 kontrast).
  - `.field-select` / `.admin-select` ok SVG'leri sabit gri (`#5a6270`); harita (`CityMap.tsx`) koyu tema stili yok; giriş yapmamış ziyaretçiler için üst menüde/footer'da tema değiştirme linki yok (`/ayarlar/gorunum` erişilmez durumda çünkü `/ayarlar` girişe yönlendiriyor).
  - Admin [ui.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/admin/ui.tsx#L476) `BulkBar` ve [admin/ilanlar.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/admin/ilanlar.tsx#L162) `bg-ink` (`#05070a`) yüzünden koyu temada arka planla kayboluyor.
- **Kalan etkileşim & rota pürüzleri:**
  - [satici/$id.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/satici/$id.tsx#L116-L118) `listings`, `reviews` ve `page` state'leri satıcı geçişinde sıfırlanmıyor; [mesajlar/$id.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/mesajlar/$id.tsx#L272-L284) masaüstü bölünmüş görünümde sohbet değişiminde `text`/`replyTo`/`staged` sıfırlamıyor.
  - [ListingSections.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/listing/detail/ListingSections.tsx#L267-L285), [mesajlar.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/mesajlar.tsx#L276), [mesajlar/$id.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/mesajlar/$id.tsx#L859) ve [MessageBubble.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/chat/MessageBubble.tsx#L153) `formatPrice()` çağrısında `currency` parametresi geçmiyor (`₺` sabit).
  - [search.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/search.tsx#L330) `attr_*` çip silmede `apply()` çağırıyor; [category/$slug.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/category/$slug.tsx#L151) aktif filtre çipleri ve mobil sıralama çekmecesi eksik.
  - Yerel tarayıcı diyalogları: [ilan-ver.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ilan-ver.tsx#L320) `window.confirm()` ve [ayarlar/guvenlik.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ayarlar/guvenlik.tsx#L76) `window.prompt()` kullanıyor.
- **Erişilebilirlik (A11y):**
  - [SearchBar.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/navbar/SearchBar.tsx#L255-L283)'ta `<div role="button">` içinde `<button>` ve `type="search"` + özel `<X>` yüzünden çift temizle düğmesi.
  - `MegaMenu` klavye/Escape/dış-tıklama ile kontrol edilemiyor; admin tablolarındaki `<tr onClick>` satırları klavyeyle açılamıyor.

### 2.2 Mobil Uygulama Tasarım & Sohbet Kalanları
- **Sohbet performansı & senkronizasyon:**
  - [mesaj/[id].tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/mesaj/[id].tsx#L608-L644) `SwipeToReply` memoize edilmediği ve `renderItem` içinde satır içi callback aldığı için her tuş vuruşunda görünür satırlar yeniden render oluyor; ayrıca arka plan refetch'i (`staleTime: 0`) `pending: 'failed'` mesajları ve yüklenen eski sayfaları silebiliyor.
  - `OfferComposer`, `ReportComposer` ve `SearchSheet` kapanınca state sıfırlamıyor; uzun basma "Yanıtla" input'a odaklanmıyor.
- **Kalan arayüz eksikleri:**
  - `RowGroup` ikonsuz satırlarda da `inset={56}` çizgi koyuyor ([Bits.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/ui/Bits.tsx#L282)).
  - **9 kaydırılabilir ekranda `insets.bottom` eksik** (`bildirimler`, `son-bakilanlar`, `ilanlarim`, `kategoriler`, `sayfa/[slug]`, `ayarlar/index`, `ayarlar/gorunum`, `ayarlar/guncelleme`, `doping`); `ayarlar/sablonlar.tsx` `KeyboardAwareScrollView` kullanmıyor.
  - [ilan/[id].tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/ilan/[id].tsx#L497) satıcı avatar fotoğrafını göstermiyor (`api/mobile/listings/$id.ts` `avatar_url` seçmiyor); [Gallery.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/features/listing/Gallery.tsx#L148-L195) yakınlaştırma hâlâ JS thread'de (`runOnJS: true`) çalışıyor.
  - `ListingSheets.tsx` (`MessageSheet`, `OfferSheet`) ve `ayarlar/guvenlik.tsx` (`DeleteAccountSheet`) `onDismissed` beklemeden yönlendirme yapıyor.
  - `ayarlar/guncelleme.tsx` "Şimdi yeniden başlat" düğmesinde busy/disabled koruması yok.

---

## 3. İşlev Eksikleri, Web ↔ Mobil Parite & Admin Paneli

### 3.1 Web ↔ Mobil Özellik Parite Tablosu

| Özellik | Web | Mobil | Eksik / Not |
|---|---|---|---|
| **Harita ile keşif** | `/harita` (Leaflet il sayıları) | **Yok** (`links.ts` `null` döner) | Mobilde harita keşif ekranı eksik |
| **E-posta değiştirme & doğrulama durumu** | Var (`changeEmail` + rozet) | Yalnız doğrulama yeniden gönder | Doğrulanmış olsa bile buton hep görünüyor; e-posta değiştirme yok |
| **Açık oturum listesi & tekil kapatma** | Var (`listSessions` / `revokeSession`) | Yalnız "Diğer cihazlardan çık" | Cihaz listesi ve tek oturum kapatma yok |
| **Google-only hesap tespiti** | Şifre formunu gizler | Şifre formunu her zaman gösterir | Google kullanıcılarında kafa karışıklığı |
| **KVKK veri indirme** | Doğrudan oturumlu API | Tarayıcıda web URL açar | Mobilde yeniden giriş gerektiriyor |
| **Satıcı yorumları sayfalama** | Var (`getSellerReviews`) | İlk 20 yorumla sınırlı | 20+ yorumlu satıcılarda eski yorumlar görünmüyor |
| **Mağaza ayarları hata durumu** | Var | `me.isError` yok ([ayarlar/magaza.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/ayarlar/magaza.tsx#L48-L57)) | Ağ hatasında "Kurumsal mağaza başvurusu" ekranına düşüyor |
| **İlan önizleme boolean biçimi** | Türkçe | `true`/`false` basıyor ([ilan-ver.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/ilan-ver.tsx#L714)) | `Evet`/`Hayır` olmalı |

### 3.2 Gelir Modeli (`doping`, `kredi`, `mağaza`) Tamamlanmamışlığı
- **`doping_enabled` çıkmazı:** Web ve mobildeki `/doping` ekranları statik "kapalı/yakında" sayfası; sunucuda `requestCreditOrder` ve `applyBoost` koşulsuz hata fırlatıyor ([account.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/account.ts#L288-L334)). Buna karşın admin kredi eklediğinde kullanıcıya `/doping` linkli bildirim gidiyor ve kullanıcının bakiyesini görebileceği/harcayabileceği ekran yok.
- **Ödeme & mağaza kuralları:** IBAN ayarları kaydediliyor ama alıcıya gösterilmiyor; iyzico/PayTR ve mobil uygulama içi satın alma (App Store IAP / Google Play Billing) entegre değil. `STORE_PLANS` (`BASIC`/`PRO`/`PREMIUM`) hiçbir kota, rozet veya süre kuralına bağlı değil.
- **Muhasebe/KVKK çakışması:** [account-purge.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/account-purge.ts#L23-L25) hesap silinince `credit_orders` ve `credit_ledger` kayıtlarını tamamen siliyor; mali kayıtların anonimleştirilerek saklanması gerekebilir.

### 3.3 Admin Paneli Eksikleri
1. **Çökme kayıtlarında stack trace görünmüyor:** [ota.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/ota.ts#L95-L103) `client_errors` tablosundan `stack` ve `device_id` sütunlarını seçmiyor; yalnızca son 30 satır filtresiz gösteriliyor.
2. **Eksik kalan arayüz ve veri tutarsızlıkları:**
   - [sistem.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/admin/sistem.tsx) sunucudan dönen `lastCronRun` değerini göstermiyor.
   - `legal_page_revisions` ([admin/content.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/content.ts#L49-L52)) sadece yazılıyor; geçmişi görüntüleme/geri alma arayüzü yok.
   - 13 admin sayfasında `q.error` kontrolü `!q.data` olmadan yazılmış → arka plan yenileme hatasında ekrandaki veriler siliniyor.
   - `moderasyon.tsx` mobilde 100 satırlık kuyruğu inceleme panelinin üstünde sınırsız yükseklikle gösteriyor; `yorumlar.tsx` filtre değişince seçili satırları temizlemiyor; `sikayetler.tsx` "Tümünü seç" yok ve ilan kaldırmada `status_before_ban` temizlenmiyor ([moderation.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/moderation.ts#L170)); `kategoriler.tsx` kaydedilmemiş değişiklik uyarısı yok; `adminUpdateListing` şehir değişince ilçeyi boşaltamıyor ([admin/listings.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/listings.ts#L432)).
   - `ilanlar.tsx` "Açık şikayeti olanlar" filtresi sohbet şikayetlerini hariç tutmazken rozet hariç tutuyor (`0` şikayetli ilanlar listede görünüyor).
   - `finans.tsx` sipariş numarasını ilk 14 karakterle kısaltıp arama kutusunda tam eşleşme bekliyor; kredi hareketleri (ledger) sekmesinde arama/filtre/CSV yok.
   - `AdminShell.tsx` mobilde `"Siteye git"` linkini gizliyor; `useRunner` her küçük işlemde tüm `["admin"]` önbelleğini geçersiz kılıyor.
   - `api/ota/publish/update.ts` yayın işlemlerini `admin_audit_log`'a yazmıyor.
   - **Eksik operasyonel özellikler:** Mağaza başvuru kuyruğu, ilan red gerekçesi için kalıcı `rejection_reason` sütunu, `ListingSheet`'te fotoğraf/özellik düzenleme, aktif doping/vitrin yönetim ekranı.

---

## 4. SEO, Performans, DevOps & Mağaza Hazırlığı

### 4.1 Navigasyon & SEO Kalanları
- **Statik menü kopukluğu:** [nav-data.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/navbar/nav-data.ts) veritabanından bağımsız sabit dizi; 17+ tekrarlı üst-slug linki içeriyor ve bazı ana kategoriler (`İş Makineleri`, `Özel Ders`, `Yardımcı Arayanlar`) menüde eksik.

### 4.2 Performans, Ölçeklenme ve Önbellek
- **Tek-process kısıtı:** [chat-bus.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/chat-bus.ts), `rateLimit`, `mobile-oauth` PKCE kodları ve görsel/tile önbellekleri süreç içi bellekte tutuluyor; 2. sunucu kopyasına geçildiğinde canlı sohbet, çevrimiçi durumu ve OAuth kırılır. Ayrıca SSE için kullanıcı başı eşzamanlı bağlantı limiti yok ve ban/oturum iptalinde açık SSE akışları kesilmiyor.
- **Veritabanı indeks eksikleri:** `listings(status, expires_at)`, `listings(status, featured_until)`, `stores(lower(slug))`, `reports(conversation_id, status)`, `profiles(last_seen_at)` indeksleri ile `stores(user_id)` tekil indeksi ve `price > 0` / `rating BETWEEN 1 AND 5` `CHECK` kısıtları eksik. `/api/mobile/listings` tam metin kelime aramasını kullanmıyor.
- **Önbellek başlıkları:** `GET /api/mobile/listings/$id` kullanıcıya özel alanlar (`isFavorite`, `isOwner`) dönmesine rağmen `Cache-Control: private, no-store` koymuyor; `GET /api/avatar/$id` `?v=` olmadan bile `immutable` veriyor; SSR sayfaları nonce/tema içerdiği hâlde açık `private, no-store` taşımıyor.
- **Postgres `bytea` büyümesi:** İlan/sohbet/avatar fotoğrafları ve OTA paketleri Postgres içinde tutuluyor; trafik büyüdükçe S3/Cloudflare R2'ye geçiş planlanmalı.
- **Mobilde çevrimdışı direnç:** `onlineManager`/ağ durumu kontrolü yok (`20s` timeout × 2 retry → 60 sn+ bekleme); `nearby.ts` konum çağrısında zaman aşımı yok; `mapHtml.ts` Leaflet'i üçüncü parti `unpkg.com`'dan çekiyor.

### 4.3 DevOps, CI/CD & Mağaza Yayın Engelleri
- **CI/CD eksikliği:** `.github/workflows/` altında yalnız [ios-build.yml](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/.github/workflows/ios-build.yml) var. `web` (`tsc`, `eslint`, `npm test`, `vite build`) ve `mobile-app` (`tsc`, `expo lint`) için otomatik PR/push kontrol akışı yok.
- **Sağlık kontrolü:** [Dockerfile](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/Dockerfile) içinde `HEALTHCHECK` ve uygulamada `/api/health` ucu yok. [nixpacks.toml](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/nixpacks.toml) `fonts-dejavu-core` kurmuyor; `.env.example` `CRON_SECRET`, `OTA_PUBLISH_TOKEN`, `TRUSTED_IP_HEADER`, `DB_POOL_MAX` değişkenlerini içermiyor.
- **Test açıkları:** `verilerim.ts`, `account-purge.ts`, `auth/server.ts`, `chat.ts`/`stream.ts`, `upload.server.ts`, `admin/*` ve `cron/sweep.ts` için test yok.
- **App Store / Google Play engelleri:**
  1. **Sign in with Apple yok** (iOS'ta Google girişi varken Apple Guideline 4.8 gereği zorunlu).
  2. **Android FCM eksik:** [app.json](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/app.json)'da `android.googleServicesFile` yok; standalone Android build'de push çalışmaz.
  3. **Deep link / Universal Link kırıkları:** [app-links.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/server/middleware/app-links.ts#L18-L26) hâlâ placeholder (`APPLE_TEAM_ID`, boş SHA-256) döndüğü için `/.well-known/*` 404 veriyor; mobilde `+native-intent.tsx` olmadığı için `geldesat://mesajlar/...`, `/category/...`, `/search` bağlantıları `+not-found` ekranına düşüyor.
  4. `app.json`'da `ACCESS_FINE_LOCATION` yokken `LocationPicker` `Accuracy.High` istiyor; `associatedDomains` apex alan adını (`geldesat.com`) içermiyor; `slug` hâlâ kişisel `"muhammed-tayyip"`.

### 4.4 Kod Sağlığı & Teknik Borç
- **Monolitik dosyalar:** `web/src/routes/mesajlar/$id.tsx` (1.641 satır), `mobile-app/src/app/mesaj/[id].tsx` (1.147 satır), `web/src/routes/ilan-ver.tsx` (1.046 satır), `web/src/components/admin/ui.tsx` (854 satır), `web/src/routes/ilan/$slug.tsx` (785 satır), `web/src/routes/search.tsx` (776 satır), `mobile-app/src/app/ilan-ver.tsx` (775 satır).
- **Yinelenen yapı:** `search.tsx` ile `category/$slug.tsx` paralel filtre/çekmece mantığı taşıyıp davranış olarak ayrışmış. `locations.ts` ve `chat-shared.ts` web ve mobilde kopyalanmış ve sapmaya başlamış.
- **Ölü kod & gereksiz bağımlılıklar:** `web/package.json`'da **17 kullanılmayan paket** (`vaul`, `zustand`, `react-hook-form`, `@tanstack/react-table`, `date-fns`, 8+ kullanılmayan `@radix-ui/*` paketi), `web/src/components/ui/` altında 12 kullanılmayan bileşen, `mobile-app`'te kullanılmayan `expo-system-ui` ve `catalog.siteSettings` / `useStyles`.

---

## 5. Ürün ve Pazar Yeri Önerileri (Sahibinden / Letgo / Dolap Kıyaslaması)

1. **İlan detayına doğrudan "Teklif Ver" düğmesi ekle (En yüksek ROI):**
   Teklif / karşı teklif altyapısı sohbette **zaten hazır**, ama ataş menüsünün içine gizli. İlan detay sayfasında "Mesaj Gönder" yanına "Teklif Ver" koymak alıcı-satıcı etkileşimini ciddi ölçüde artırır.
2. **Kayıtlı Arama & Fiyat Düşüşü Bildirimi ("Aramayı Kaydet / Fiyat Düşünce Haber Ver"):**
   Fiyat geçmişi (`listing_price_history`) ve push altyapısı zaten var. Favorideki ilanın fiyatı düştüğünde otomatik bildirim + belirli filtreye yeni ilan gelince bildirim, kullanıcıyı uygulamaya geri döndüren en güçlü döngüdür.
3. **Eksik kritik arama filtrelerini aç:**
   - **Mahalle filtresi** (ilan verirken zaten toplanıyor ve sunucu sorgusunda destekleniyor)
   - **İlan tarihi filtresi** ("Son 24 saat / 3 gün / 7 gün")
   - **Hızlı anahtarlar** ("Sadece fotoğraflı", "Fiyatı düşenler", "Sahibinden / Mağazadan")
4. **Gerçek canlı arama önerisi (Autocomplete) & İlan No hızlı geçişi:**
   Web `SearchBar` şu an yalnız 10 sabit popüler kelimeyi filtreliyor; sunucudan kategori, marka/model, şehir ve doğrudan ilan numarası önerisi döndürmek arama deneyimini üst seviyeye taşır.
5. **Filtreli "Haritada Ara" (Web + Mobil):**
   Emlak ve yerel alışverişte kategori/fiyat filtreli, yakınlaştırdıkça ilan iğneleri ve mini kart önizlemesi gösteren interaktif harita (hem web `/harita` geliştirme hem mobilde yeni ekran).
6. **Satıcı / Mağaza deneyimi & güven sinyalleri:**
   - Satıcı sayfasında mağaza içi arama, kategori filtresi ve **"Satıcıyı Takip Et"**
   - İlan kartında fotoğraf sayısı (`1/8`), fiyat düşüşü etiketi ve kurumsal mağaza rozeti
   - Satıcı kartında doğrulanmış e-posta/telefon rozeti, ortalama yanıt süresi ve çevrimiçi durumu
   - İlan galerisinde web'de **tıklayarak/çift dokunarak yakınlaştırma (zoom)**
7. **Satıcı verimliliği:** `"Benzer ilan ver"` (ilan kopyalama), ilan düzenlerken red gerekçesini doğrudan üst bantta görme, vasıta/emlak için yan yana **İlan Karşılaştırma**.

---

## 6. Kalan Önceliklendirilmiş Eylem Planı

| Faz | Odak | Başlıca İşler |
|---|---|---|
| **Faz A (Kalan Güvenlik & Kararlılık)** | Güvenlik, veri tutarlılığı & test | HEIC boyut kontrolü öncesi WASM koruması; `client_errors` global kota; mobil OAuth `Secure` çerez; Google-only admin tazelik kontrolü; `/api/mobile/*` CSRF/`Content-Type`; `checkReviewEligibility` tekilliği; `adminUpdateCategory` transaction; `assertCanMessage` gönderici kontrolü; cron/digest kilidi & hata kurtarma; transaction düzeltmeleri. |
| **Faz B (Kalan Tasarım & UX)** | Arayüz cilası & mobil parite | Web `mobile-content-space` / `CookieBanner` / `search.tsx` alt çubuk uyumu; koyu tema kategori tonları + tema seçici; `satici/$id` ve `mesajlar/$id` geçiş sıfırlama; kalan para birimi ve `SearchBar`/`MegaMenu` A11y düzeltmeleri; mobil `insets.bottom`, `Gallery.tsx` worklet zoom, `SwipeToReply` memoization, `onlineManager`. |
| **Faz C (Admin, DevOps & İndeksler)** | Operasyon & otomasyon | GitHub Actions web+mobil CI; `/api/health` + Dockerfile `HEALTHCHECK`; Admin `client_errors` stack trace görüntüleyici, `lastCronRun`, `q.error && !q.data`, `moderasyon` mobil düzeni; eksik DB indeksleri; `nav-data.ts` dinamikleştirme. |
| **Faz D (Mağaza & Gelir)** | Yayın & monetizasyon | Sign in with Apple; Android FCM `googleServicesFile`; `.well-known` + `+native-intent.tsx`; OTA kod imzası; gerçek Doping/Kredi/Ödeme akışı (web ödeme + mobil IAP kararı); mağaza başvuru & plan kuralları. |
| **Faz E (Ürün & Büyüme)** | Rekabet avantajı & ölçek | İlan detayda "Teklif Ver", kayıtlı arama & fiyat düşüşü bildirimi, mahalle/tarih filtreleri, canlı autocomplete, mobil harita, satıcı takip, ölü kod / kullanılmayan paket temizliği, S3/R2 + Redis/LISTEN-NOTIFY hazırlığı. |
