# GeldeSat Kapsamlı Proje Tarama Raporu

**Tarih:** 22 Kasım 2026 · **İncelenen Dal / Commit:** `master` (`2d6454f`)  
**Kapsam:** `web/` (TanStack Start + PostgreSQL), `mobile-app/` (Expo SDK 58 / React Native), Admin Paneli, SEO/DevOps ve Pazar Yeri Ürün Deneyimi.

> [!NOTE]
> Önceki denetim (`DENETIM_RAPORU.md` / `DUZELTME_PLANI.md`, 7-8 Kasım 2026) Faz 0–13 kapsamında pek çok temel güvenlik ve durum makinesi sorununu çözmüş. Bu rapor **bugün `master` üzerinde hâlâ canlıda etkili olan yeni/kalan hataları**, son commit'lerdeki yan etkileri, **tasarım/UX pürüzlerini**, **web–mobil parite açıklarını** ve **ürün/büyüme önerilerini** doğrudan kaynak koddan doğrulanmış satır numaralarıyla listeler.

---

## Genel Değerlendirme & Güçlü Yönler

Proje genel mimari olarak oldukça olgun ve disiplinli kurulmuş:
- **Güvenlik temeli sağlam:** Tüm SQL sorguları parametreli (`$1`), kritik sır karşılaştırmalarında `timingSafeEqual` kullanılıyor, üretimde nonce tabanlı CSP ([csp.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/csp.ts)), `jsonLd()` kaçışı, dosya yüklemede magic-byte kontrolü ve gövde boyutu limitleri (`readLimited`) mevcut.
- **İyi mühendislik kalıpları:** Özellik anahtarları (feature flag) sistemi + otomatik kod-test uyumu ([flags-in-code.test.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/flags-in-code.test.ts)), kendi kendini barındıran OTA güncelleme altyapısı + native parmak izi kilidi ([ota-publish.mjs](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/scripts/ota-publish.mjs)), `defaultRemountDeps` ile temiz rota geçişleri ([router.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/router.tsx#L46)).
- **Modern mobil yığın:** Expo SDK 58, Expo Router, FlashList, React Query, Reanimated 4, koyu/açık tema token uyumu.

Ancak taramada **canlıda doğrudan bozuk çalışan işlevler**, **yüksek öncelikli güvenlik/kararlılık açıkları**, **görünür tasarım/katman çakışmaları** ve **önemli SEO/gelir/mağaza engelleri** tespit edildi.

---

## 1. Acil / Kritik ve Yüksek Öncelikli Hatalar

> [!CAUTION]
> Bu bölümdeki maddeler canlı kullanıcı akışlarını, KVKK uyumunu, sunucu kararlılığını veya güvenliğini doğrudan etkiliyor. İlk müdahale buradan başlamalı.

### 1.1 Canlıda Kırık İşlevler

| Öncelik | Sorun | Konum | Etki |
|---|---|---|---|
| **KRİTİK** | **KVKK veri indirme ucu her zaman çöküyor** | [verilerim.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/hesap/verilerim.ts#L59) vs [0017_mobile_push_tokens.sql](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/migrations/0017_mobile_push_tokens.sql#L2-L7) | `mobile_push_tokens` tablosunda `created_at` sütunu yok; `Promise.all` içinde sorgulandığı için **her KVKK md. 11 veri indirme isteği `42703` SQL hatasıyla `400` dönüyor.** Ayrıca tek istekte 16 paralel sorgu açılıyor ve `RateLimitError` `429` yerine `400` dönüyor. |
| **YÜKSEK** | **Admin "Onayla ve yayına al" `PENDING` dışı ilanlarda hep hata veriyor** | [listings.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/listings.ts#L273-L279), [ListingSheet.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/admin/ListingSheet.tsx#L261-L265), [ilanlar.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/admin/ilanlar.tsx#L442-L445) | Sunucuda `ACTION_FROM.approve` yalnız `["PENDING"]` kabul ediyor (`activate` ise `INACTIVE/PENDING/REJECTED`). Arayüzde reddedilmiş/pasif ilanlardaki yeşil buton da `"approve"` gönderdiği için işlem her zaman reddediliyor. |
| **YÜKSEK** | **Web'de şeffaf `DropdownMenu` ve üstte kalan `.site-header`** | [dropdown-menu.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/ui/dropdown-menu.tsx#L43-L76), [ilanlarim.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ilanlarim.tsx#L271), [styles.css](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/styles.css#L226-L228) | `styles.css` özel token'lar kullanırken shadcn bileşenleri tanımsız `bg-popover`, `bg-background`, `focus:bg-accent`, `text-muted-foreground` sınıflarını kullanıyor (`/ilanlarim` menüsü şeffaf açılıyor). Üstüne `.site-header { z-index: 90 }` tüm `z-50` modal/çekmecelerin **üstünde** kalıyor. |
| **YÜKSEK** | **Mobilde `FilterSheet` içinde iç içe `<Modal>` (iOS donma riski)** | [FilterSheet.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/features/search/FilterSheet.tsx#L75-L162) | `FilterSheet` bir `<Sheet>` (`<Modal>`) açarken içinde `CategoryPicker` ve `OptionPicker` için ikinci bir `<Sheet>` (`<Modal>`) render ediyor. iOS'ta aktif modal üstüne iç içe modal açılması donma/sessiz başarısızlığa yol açar. |
| **YÜKSEK** | **Android'de `Sheet` içi klavye kaçışı çalışmıyor** | [Sheet.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/ui/Sheet.tsx#L98-L128) | Android'de `KeyboardAvoidingView behavior="padding"` kullanılıyor ama içindeki `Animated.View` `position: 'absolute', bottom: 0` olduğu için ebeveyn padding'i onu yukarı itmiyor; teklif, şikayet, arama, yorum ve filtre formları klavye altında kalabiliyor. |
| **YÜKSEK** | **Mobilde satılan/süresi dolan ilan favoriden çıkarılamıyor** | [favorites.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/favorites.ts#L39-L48) | `POST /api/mobile/favorites` önce ilanın `ACTIVE` olup olmadığını sorguluyor; favoriden çıkarma kontrolü sonra geldiği için satılmış/süresi dolmuş ilanlar mobilde favori listesinden silinemiyor. |
| **YÜKSEK** | **404 veren `/sayfa/yardim` bağlantıları** | [AccountShell.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/account/AccountShell.tsx#L99), [MobileNavigationDrawer.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/navbar/MobileNavigationDrawer.tsx#L266-L267) | Veritabanında `yardim` sayfası yok (yalnız `iletisim` var); tüm hesap sayfalarının sol menüsü ve mobil çekmece 404'e gidiyor. |

### 1.2 Sunucu Kararlılığı, Güvenlik ve Veri Bütünlüğü

| Öncelik | Sorun | Konum | Etki & Çözüm |
|---|---|---|---|
| **YÜKSEK** | **Better Auth `pg.Pool`'da `error` dinleyicisi yok (sunucu çökme riski)** | [auth/server.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/auth/server.ts#L53-L55) | `db.ts`'den ayrı ikinci bir `Pool` açılmış; `pool.on("error", ...)` olmadığı için boştaki bir Postgres bağlantısı koparsa Node süreci `uncaughtException` ile düşer. Ayrıca `statement_timeout` ve `idleTimeoutMillis` eksik. |
| **YÜKSEK** | **Sahtelenebilir `X-Forwarded-For` + sınırsız bellekli hız sınırı** | [helpers.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/helpers.ts#L62-L88), [helpers.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/helpers.ts#L430-L438) | `TRUSTED_IP_HEADER` yoksa (veya başlık gelmezse) en soldaki `X-Forwarded-For` değerine güveniliyor — saldırgan başlığı değiştirerek tüm IP hız sınırlarını aşabilir ve `buckets` haritasını sınırsız büyüterek OOM tetikleyebilir. |
| **YÜKSEK** | **`/api/geo` Nominatim kuyruk tıkanması (DoS)** | [geo.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/geo.ts#L43-L64) | Önbellek dışı istekler `nextSlot += 1100ms` ile sınırsız sıraya diziliyor; eşzamanlı aynı sorgular tekilleştirilmiyor ve kuyruk üst sınırı yok. 1000 istek tüm kullanıcılar için konum aramasını ~18 dk kilitler. |
| **YÜKSEK** | **HEIC çözümleme boyut kontrolünden önce ana thread'i kilitliyor** | [image-pipeline.server.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/image-pipeline.server.ts#L129-L142) | `heic-decode` (WASM) tüm piksel tamponunu açtıktan sonra `MAX_INPUT_PIXELS` kontrolü yapılıyor; büyük boyutlu hazırlanmış bir HEIC dosyası tek Node event loop'unu dondurup belleği tüketebilir. |
| **YÜKSEK** | **OTA manifestinde doğrulanmamış `X-Forwarded-Host` & imzasız paket** | [ota.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/ota.ts#L71-L76), [assets.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/ota/publish/assets.ts#L31) | Asset URL'leri gelen `Host`/`X-Forwarded-Host` başlığından üretiliyor (`BETTER_AUTH_URL` sabitlenmeli). Yayın ucunda hız sınırı ve gövde boyutu limiti yok; paketler RSA imzasız. |
| **YÜKSEK** | **Migration çalıştırıcıda `pg_advisory_lock` yok** | [migrate.mjs](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/scripts/migrate.mjs#L46-L73) | Coolify rolling deploy sırasında iki konteyner aynı anda başlarsa aynı SQL dosyasını paralel uygulayıp çakışabilir. |
| **YÜKSEK** | **Kimliksiz `client_errors` yazma taşması** | [client-errors.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/client-errors.ts#L28-L46) | Sahtelenebilir IP limiti dışında global kota veya tekilleştirme yok; 30 gün saklanan hata tablosu şişirilebilir. |
| **ORTA** | **Mobil OAuth `Secure` çerezi reverse proxy arkasında düşüyor** | [start.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/oauth/start.ts#L24), [done.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/oauth/done.ts#L17-L20) | `url.protocol === "https:"` proxy arkasında `http:` olur → `gs-oauth-challenge` `Secure` olmadan gider ve `/done` sonrası temizlenmez. |
| **ORTA** | **Admin duyuruda açık yönlendirme (`//evil.com`)** | [admin/content.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/content.ts#L146) | `safeRedirect` yerine yalnızca `startsWith("/")` kontrol ediliyor. |
| **ORTA** | **Google-only admin rol değişiminde yeniden doğrulamayı atlıyor** | [admin/users.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/users.ts#L248-L260) | Şifresi olmayan Google yöneticisi, 60 günlük oturumla tazelik kontrolü olmadan başka kullanıcıyı `ADMIN` yapabiliyor. |
| **ORTA** | **Arama `attrs` filtresinde sınırsız SQL / kaçışsız `LIKE`** | [catalog.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/catalog.ts#L45), [catalog.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/catalog.ts#L192-L205) | Anahtar/değer sayısı sınırsız ve `like $p \|\| ', %'` değerinde `escapeLike()` yok (`%` ve `_` joker karakter olarak işleniyor). |
| **ORTA** | **İnceleme uygunluğu (`checkReviewEligibility`) tekillik kuralıyla çelişiyor** | [social.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/social.ts#L138-L143) | DB satıcı+yorumcu başına tek puan tutuyor ama web sorgusu hâlâ `listing_id` ile filtreliyor; aynı satıcının başka ilanında eski yorum gizlenip sessizce üzerine yazılıyor. |
| **ORTA** | **Kategori slug güncellemesi çakışma kontrolünden önce `category_old_slugs` tablosunu bozuyor** | [admin/categories.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/categories.ts#L274-L281) | Transaction yok ve slug çakışınca eski yönlendirme kayıtları bozulmuş hâlde kalıyor. |
| **ORTA** | **Çerez kabul eden `/api/mobile/*` POST uçlarında CSRF / `Content-Type` kontrolü eksik** | [rpc/$fn.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/rpc/$fn.ts#L117-L128), [notifications.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/api/mobile/notifications.ts#L31) | `Authorization: Bearer` yanında tarayıcı çerezini de kabul eden mobil uçlar `Content-Type: application/json` veya `Sec-Fetch-Site` denetlemiyor (`notifications.ts`'de gövde limiti de yok). |
| **ORTA** | **Admin temel yasal sayfaları sunucudan silebilir** | [admin/content.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/content.ts#L67-L76) | `sayfalar.tsx` arayüzde `LINKED` sayfaların Sil düğmesini gizlese de sunucu `adminDeletePage` içinde koruma yok. |
| **ORTA** | **Silinme sürecindeki hesap mesaj göndermeye devam edebiliyor** | [chat.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/chat.ts#L67-L70) | `assertCanMessage` yalnızca alıcıyı (`to`) kontrol ediyor, göndericiyi (`from`) kontrol etmiyor. |
| **ORTA** | **Cron + trafik bazlı süpürme çakışması & başarısız e-posta kaybı** | [message-digest.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/message-digest.ts#L66-L84), [ops.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/ops.ts#L6-L31) | Kilit olmadığı için eşzamanlı çalışma mükerrer bildirim/e-posta atabilir; `last_message_email_at` SMTP gönderiminden **önce** yazıldığı için SMTP kesintisinde özet e-postaları kalıcı olarak atlanır. |

---

## 2. Tasarım, Arayüz (UI) ve Deneyim (UX) Eksikleri

### 2.1 Web Arayüzü & Tasarım
- **Katman ve yapışkan (sticky) çakışmaları:**
  - Masaüstü [Navbar.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/Navbar.tsx#L177-L334) 2 satır toplam **108px** (`h-16` + `h-11`), ancak yapışkan paneller ([ilan/$slug.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ilan/$slug.tsx#L336), [ilan-ver.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ilan-ver.tsx#L851), [AccountShell.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/account/AccountShell.tsx#L153), [sayfa/$slug.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/sayfa/$slug.tsx#L126)) `top-24` (**96px**) kullanıyor → 12px üst menü altında kalıyor.
  - Mobil webde [__root.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/__root.tsx#L128) `/ilan-ver` sayfasında `BottomNav`'ı gizlemediği için sabit adım çubuğu ([ilan-ver.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ilan-ver.tsx#L1038-L1041)) ortadaki çıkıntılı "İlan Ver" FAB'ının altında kalıyor. Aynı çakışma [CookieBanner.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/layout/CookieBanner.tsx#L27-L28) ve [search.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/search.tsx#L616) yüzen filtre çubuğunda da var.
  - `mobile-content-space` [__root.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/__root.tsx#L154)'te `<Footer />` yerine `<main>` üzerinde; mobilde footer'ın üstünde boşluk, altında ise `BottomNav` tarafından örtülen telif satırı oluşuyor.
- **Karanlık tema pürüzleri:**
  - `::selection` ([styles.css](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/styles.css#L143-L145)) sabit `white` ile karıştırıldığı için koyu temada seçilen metin okunmuyor.
  - Ana sayfa kategori şeridi ([index.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/index.tsx#L188)) açık tema hex tonlarını (`#475467`, `#1a4fd8`) koyu arka planda kullanıyor (~2.1:1 kontrast).
  - `.field-select` / `.admin-select` ok SVG'leri sabit gri (`#5a6270`); harita (`CityMap.tsx`) koyu tema stili yok; giriş yapmamış ziyaretçiler için üst menüde/footer'da tema değiştirme linki yok (`/ayarlar/gorunum` erişilmez durumda çünkü `/ayarlar` girişe yönlendiriyor).
  - [Footer.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/layout/Footer.tsx#L48-L81) `bg-ink` üstünde `text-subtle` (~3.8:1 kontrast, AA altı) ve sabit `"Adana, Türkiye"` metni içeriyor.
  - Admin [ui.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/admin/ui.tsx#L476) `BulkBar` ve [admin/ilanlar.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/admin/ilanlar.tsx#L162) `bg-ink` (`#05070a`) yüzünden koyu temada arka planla kayboluyor.
- **Görsel ve etkileşim hataları:**
  - `buttonVariants` (`inline-flex`) üzerine `block` / `inline-block` verilmesi ikon+metin hizalamasını bozuyor ([ilan/$slug.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ilan/$slug.tsx#L408), [ilanlarim.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ilanlarim.tsx#L157)).
  - [profil.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/profil.tsx#L106-L111) mağazası olmayan ve doping kapalı kullanıcılarda boş kenarlıklı kart kutusu çiziyor.
  - [sifre-sifirla.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/sifre-sifirla.tsx#L114) süresi dolmuş token hatasını `setFlash` ile gönderiyor; [__root.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/__root.tsx#L111) tüm flash mesajları **yeşil `toast.success`** olarak gösteriyor!
  - `ListingImageGallery.tsx` var olmayan `scrollbar-none` sınıfını kullanıyor (`styles.css`'de adı `.no-scrollbar`).
  - Dil/yazım tutarsızlıkları: `"şimdi önce"` / `"15 Eyl 2026 önce"` ([ayarlar/guvenlik.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ayarlar/guvenlik.tsx#L172)), `"5 gündır"` / `"3 sadır"` ([admin/index.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/admin/index.tsx#L69)), `"Anasayfa"` vs `"Ana Sayfa"`.
  - Yerel tarayıcı diyalogları: [ilan-ver.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ilan-ver.tsx#L320) `window.confirm()` ve [ayarlar/guvenlik.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ayarlar/guvenlik.tsx#L76) `window.prompt()` kullanıyor.
- **Erişilebilirlik (A11y):**
  - İç içe `<main>` etiketi ([__root.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/__root.tsx#L154) içinde [ilan-ver.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/ilan-ver.tsx#L452)).
  - [SearchBar.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/navbar/SearchBar.tsx#L255-L283)'ta `<div role="button">` içinde `<button>` (iç içe etkileşimli öğe) ve `type="search"` + özel `<X>` yüzünden çift temizle düğmesi.
  - `MegaMenu` klavye/Escape/dış-tıklama ile kontrol edilemiyor; admin tablolarındaki `<tr onClick>` satırları klavyeyle açılamıyor.

### 2.2 Mobil Uygulama Tasarım & Son Sohbet Değişiklikleri
- **Son sohbet commit'lerindeki (`2d6454f`, `766e541`) yan etkiler:**
  - **Kısa gelen balonlarda kaydırarak yanıtlama ölü bölgesi:** [SwipeToReply.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/features/chat/SwipeToReply.tsx#L19-L66) soldan `BACK_SWIPE_ZONE = 60pt` kesiyor; karşı tarafın balonları `x = 8..80pt` aralığında (ör. `"Olur"`, `"Tamam"`) olduğu için balonun ~%72'si ölü bölgede kalıyor ve sağa kaydırma çalışmıyor.
  - **Gönderilmemiş/hatalı mesajlar kaydırılabiliyor:** [mesaj/[id].tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/mesaj/[id].tsx#L608-L610) `SwipeToReply` için `item.message.pending` kontrolünü unutmuş — geçersiz `local-...` kimliğine yanıt alıntılanabiliyor.
  - **Gelen kutusu çevrimiçi noktası avatar'dan kopmuş:** [(tabs)/mesajlar.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/%28tabs%29/mesajlar.tsx#L307-L315) yeni tasarımda kişi avatar'ını ilan fotoğrafının sağ altına aldı ama yeşil `online` noktası ilan fotoğrafının **sol üstünde** kaldı (`left: -2, top: -2`).
  - **`jumpTo` eski mesaja kaydırmıyor:** [mesaj/[id].tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/mesaj/[id].tsx#L415-L432) sohbet içi arama veya alıntı tıklamasında `chat.around()` ile mesajı çekip vurguluyor ama `listRef`'i o mesaja kaydırmıyor.
  - **Her tuş vuruşunda tüm sohbet satırları yeniden render oluyor:** `SwipeToReply` memoize edilmediği ve `renderItem` içinde satır içi callback/render-prop aldığı için yazarken performans düşüyor; ayrıca arka plan refetch'i (`staleTime: 0`) `pending: 'failed'` mesajları ve yüklenen eski sayfaları silebiliyor.
- **Tasarım & Tema eksikleri:**
  - **Toast kontrast hatası:** [Toast.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/ui/Toast.tsx#L65-L86) ters zemin (`c.ink`: koyuda beyaz, açıkta siyah) üstüne koyu/açık tema ikon renkleri ve sabit `#8fb0ff` koyuyor (~2.0–2.9:1 kontrast).
  - **`IconButton tone="onImage"` basılınca kayboluyor:** [Button.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/ui/Button.tsx#L123-L135) açık temada basılı arka planı `c.elevated` (`#eef1f5`) yaparken ikon `#fff` kalıyor. `danger` ve `soft` butonlarda basılma geri bildirimi yok.
  - **Hesap sekmesinde boş kart:** [(tabs)/hesap.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/%28tabs%29/hesap.tsx#L167-L172) boş `RowGroup` gizlemediği için mağazasız kullanıcılarda boş şerit çiziyor; ayrıca `RowGroup` ikonsuz satırlarda da `inset={56}` çizgi koyuyor ([Bits.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/ui/Bits.tsx#L282)).
  - **Sıralama menüsünde çift ikon:** [sonuclar.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/sonuclar.tsx#L228-L238) `checked` prop'u vermediği için seçili sıralamada hem tik hem sağ ok görünüyor.
  - **Android giriş ekranı üst boşluğu:** [giris.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/giris.tsx#L89) `insets.top > 30` varsayımı çentikli/kamera delikli Android telefonlarda kapatma düğmesini durum çubuğuyla çakıştırıyor.
  - **9 kaydırılabilir ekranda `insets.bottom` eksik** (`bildirimler`, `son-bakilanlar`, `ilanlarim`, `kategoriler`, `sayfa/[slug]`, `ayarlar/index`, `ayarlar/gorunum`, `ayarlar/guncelleme`, `doping`); [ilan/[id].tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/ilan/[id].tsx#L432) fotoğrafsız ilanda bile durum çubuğunu beyaz zorluyor ve satıcı avatar fotoğrafını göstermiyor; [Gallery.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/features/listing/Gallery.tsx#L148-L195) yakınlaştırma hâlâ JS thread'de (`runOnJS: true`) çalışıyor.
  - **Yakındaki şehirde 0 ilan varsa sahipsiz buton:** [(tabs)/index.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/%28tabs%29/index.tsx#L160-L174) `ListingRail` `null` döndüğünde `"Şehri değiştir"` tek başına havada kalıyor.

---

## 3. İşlev Eksikleri, Web ↔ Mobil Parite & Admin Paneli

### 3.1 Web ↔ Mobil Özellik Parite Tablosu

| Özellik | Web | Mobil | Eksik / Not |
|---|---|---|---|
| **Harita ile keşif** | `/harita` (Leaflet il sayıları) | **Yok** (`links.ts` `null` döner) | Mobilde harita keşif ekranı eksik |
| **E-posta değiştirme & doğrulama durumu** | Var (`changeEmail` + rozet) | Yalnız doğrulama yeniden gönder | Doğrulanmış olsa bile buton hep görünüyor; e-posta değiştirme yok |
| **Açık oturum listesi & tekil kapatma** | Var (`listSessions` / `revokeSession`) | Yalnız "Diğer cihazlardan çık" | Cihaz listesi ve tek oturum kapatma yok |
| **Google-only hesap tespiti** | Şifre formunu gizler | Şifre formunu her zaman gösterir | Google kullanıcılarında kafa karışıklığı |
| **KVKK veri indirme** | Doğrudan oturumlu API (şu an 42703 ile kırık) | Tarayıcıda web URL açar | Mobilde yeniden giriş gerektiriyor |
| **Satıcı yorumları sayfalama** | Var (`getSellerReviews`) | İlk 20 yorumla sınırlı | 20+ yorumlu satıcılarda eski yorumlar görünmüyor |
| **Mağaza ayarları hata durumu** | Var | `me.isError` yok ([ayarlar/magaza.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/ayarlar/magaza.tsx#L48-L57)) | Ağ hatasında "Kurumsal mağaza başvurusu" ekranına düşüyor |
| **Para birimi tutarlılığı** | Kartlarda var; detay, sohbet, teklif ve haritada eksik (`₺` sabit) | Kartlarda var; teklif/gelen kutusunda sabit `₺` | USD/EUR ilanlarda yanlış simge |
| **İlan önizleme boolean biçimi** | Türkçe | `true`/`false` basıyor ([ilan-ver.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/src/app/ilan-ver.tsx#L714)) | `Evet`/`Hayır` olmalı |

### 3.2 Gelir Modeli (`doping`, `kredi`, `mağaza`) Tamamlanmamışlığı
- **`doping_enabled` çıkmazı:** Web ve mobildeki `/doping` ekranları tamamen statik "kapalı/yakında" sayfası; sunucuda `requestCreditOrder` ve `applyBoost` koşulsuz hata fırlatıyor ([account.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/account.ts#L288-L334)). Buna karşın admin kredi eklediğinde kullanıcıya `/doping` linkli bildirim gidiyor ve kullanıcının bakiyesini görebileceği/harcayabileceği ekran yok.
- **Ödeme & mağaza kuralları:** IBAN ayarları kaydediliyor ama alıcıya gösterilmiyor; iyzico/PayTR ve mobil uygulama içi satın alma (App Store IAP / Google Play Billing — dijital doping satışında mağaza zorunluluğu!) entegre değil. `STORE_PLANS` (`BASIC`/`PRO`/`PREMIUM`) hiçbir kota, rozet veya süre kuralına bağlı değil.
- **Muhasebe/KVKK çakışması:** [account-purge.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/account-purge.ts#L23-L25) hesap silinince `credit_orders` ve `credit_ledger` kayıtlarını tamamen siliyor; mali kayıtların anonimleştirilerek saklanması gerekebilir.

### 3.3 Admin Paneli Eksikleri (16 Ekran Özeti)
1. **Çökme kayıtlarında stack trace görünmüyor:** [ota.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/ota.ts#L95-L103) `client_errors` tablosundan `stack` ve `device_id` sütunlarını hiç seçmiyor; yalnızca son 30 satır filtresiz/gruplamasız gösteriliyor.
2. **Önceki planda `[x]` işaretlenip kodda eksik kalanlar:**
   - [sistem.tsx](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/routes/admin/sistem.tsx) sunucudan dönen `lastCronRun` değerini hiç göstermiyor.
   - `legal_page_revisions` ([admin/content.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/content.ts#L49-L52)) sadece yazılıyor; geçmişi görüntüleme/geri alma arayüzü yok.
   - 13 admin sayfasında `q.error` kontrolü `!q.data` olmadan yazılmış → arka plan yenileme hatasında ekrandaki veriler siliniyor.
   - `moderasyon.tsx` mobilde 100 satırlık kuyruğu inceleme panelinin üstünde sınırsız yükseklikle gösteriyor; `yorumlar.tsx` filtre değişince seçili satırları temizlemiyor; `sikayetler.tsx` "Tümünü seç" yok ve ilan kaldırmada `status_before_ban` temizlenmiyor ([moderation.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/moderation.ts#L170)); `kategoriler.tsx` kaydedilmemiş değişiklik uyarısı yok; `adminUpdateListing` şehir değişince ilçeyi boşaltamıyor ([admin/listings.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/admin/listings.ts#L432)).
   - `ilanlar.tsx` "Açık şikayeti olanlar" filtresi sohbet şikayetlerini hariç tutmazken rozet hariç tutuyor (`0` şikayetli ilanlar listede görünüyor).
   - `finans.tsx` sipariş numarasını ilk 14 karakterle kısaltıp arama kutusunda tam eşleşme bekliyor; kredi hareketleri (ledger) sekmesinde arama/filtre/CSV yok.
   - `AdminShell.tsx` mobilde `"Siteye git"` linkini gizliyor; `useRunner` her küçük işlemde tüm `["admin"]` önbelleğini (8.000 satırlık kategori ağacı dahil) geçersiz kılıyor.
   - `api/ota/publish/update.ts` yayın işlemlerini `admin_audit_log`'a yazmıyor.
   - **Eksik operasyonel özellikler:** Mağaza başvuru kuyruğu, ilan red gerekçesi için kalıcı `rejection_reason` sütunu (ilan sahibinin düzenleme ekranında görebilmesi için), `ListingSheet`'te fotoğraf/özellik düzenleme, aktif doping/vitrin yönetim ekranı.

---

## 4. SEO, Performans, DevOps & Mağaza Hazırlığı

### 4.1 SEO Hataları (Organik Trafik Kaybı)
- **Üst kategoriler sitemap'te yok!** [server/middleware/seo.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/server/middleware/seo.ts#L135-L145) `buildCategoriesSitemap()` doğrudan `listings.category_id` ile `INNER JOIN` yaptığı için ilanların bağlı olduğu yaprak kategorileri alıp **en yüksek arama hacimli üst kategorileri (`/category/vasita`, `/category/otomobil`, `/category/emlak`, `/category/konut`) tamamen dışarıda bırakıyor.**
- **Yapısal veri (JSON-LD) hataları** ([lib/seo.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/seo.ts#L294-L436)):
  - Araç `brand.name` alanı `"BMW"` yerine `"Otomobil"` üretiyor (`GENERIC_ROOTS` içinde `otomobil` yok).
  - Motosiklet ilanları `@type: "Car"` olarak işaretleniyor.
  - `m² (Net)` kullanıldığında `floorSize.value` `0` çıkıyor.
  - Türkçe küçük harf dönüşümünde `toLocaleLowerCase("tr")` yerine `toLowerCase()` kullanılmış.
- **Statik menü kopukluğu:** [nav-data.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/components/navbar/nav-data.ts) veritabanından bağımsız sabit dizi; 17+ tekrarlı üst-slug linki içeriyor ve bazı ana kategoriler (`İş Makineleri`, `Özel Ders`, `Yardımcı Arayanlar`) menüde eksik.

### 4.2 Performans, Ölçeklenme ve Önbellek
- **Tek-process kısıtı:** [chat-bus.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/chat-bus.ts), `rateLimit`, `mobile-oauth` PKCE kodları ve görsel/tile önbellekleri süreç içi bellekte tutuluyor; 2. sunucu kopyasına geçildiğinde canlı sohbet, çevrimiçi durumu ve OAuth kırılır. Ayrıca SSE için kullanıcı başı eşzamanlı bağlantı limiti yok ve ban/oturum iptalinde açık SSE akışları kesilmiyor.
- **Veritabanı eksikleri:** `listings(status, expires_at)`, `listings(status, featured_until)`, `stores(lower(slug))`, `reports(conversation_id, status)`, `profiles(last_seen_at)` indeksleri ile `stores(user_id)` tekil indeksi ve `price > 0` / `rating BETWEEN 1 AND 5` `CHECK` kısıtları eksik. `arama_v2` [catalog.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/src/lib/server/catalog.ts#L82)'de mobil RPC'den çağrılsa bile `platform: "web"` sabitliyor; `/api/mobile/listings` ise `arama_v2`'yi hiç kullanmıyor.
- **Önbellek başlıkları:** `GET /api/mobile/listings/$id` kullanıcıya özel alanlar (`isFavorite`, `isOwner`) dönmesine rağmen `Cache-Control: private, no-store` koymuyor; `GET /api/avatar/$id` `?v=` olmadan bile `immutable` veriyor; SSR sayfaları nonce/tema içerdiği hâlde açık `private, no-store` taşımıyor.
- **Postgres `bytea` büyümesi:** İlan/sohbet/avatar fotoğrafları ve OTA paketleri Postgres içinde tutuluyor; trafik büyüdükçe yedek ve WAL maliyetini düşürmek için S3/Cloudflare R2'ye geçiş planlanmalı.
- **Mobilde çevrimdışı direnç:** `onlineManager`/ağ durumu kontrolü yok (`20s` timeout × 2 retry → 60 sn+ bekleme); `nearby.ts` konum çağrısında zaman aşımı yok; `mapHtml.ts` Leaflet'i üçüncü parti `unpkg.com`'dan çekiyor.

### 4.3 DevOps, CI/CD & Mağaza Yayın Engelleri
- **CI/CD eksikliği:** `.github/workflows/` altında yalnız [ios-build.yml](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/.github/workflows/ios-build.yml) var. `web` (`tsc`, `eslint`, `npm test`, `vite build`) ve `mobile-app` (`tsc`, `expo lint`) için otomatik PR/push kontrol akışı yok.
- **Sağlık kontrolü:** [Dockerfile](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/Dockerfile) içinde `HEALTHCHECK` ve uygulamada `/api/health` ucu yok. [nixpacks.toml](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/nixpacks.toml) `fonts-dejavu-core` kurmuyor; `.env.example` `CRON_SECRET`, `OTA_PUBLISH_TOKEN`, `TRUSTED_IP_HEADER`, `DB_POOL_MAX` değişkenlerini içermiyor.
- **Test açıkları:** Mevcut 16 test dosyası değerli, ancak `verilerim.ts`, `account-purge.ts`, `auth/server.ts`, `chat.ts`/`stream.ts`, `upload.server.ts`, `admin/*` ve `cron/sweep.ts` için test yok (KVKK çökmesi bu yüzden kaçmış).
- **App Store / Google Play engelleri:**
  1. **Sign in with Apple yok** (iOS'ta Google girişi varken Apple Guideline 4.8 gereği zorunlu).
  2. **Android FCM eksik:** [app.json](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/mobile-app/app.json)'da `android.googleServicesFile` yok; standalone Android build'de push çalışmaz.
  3. **Deep link / Universal Link kırıkları:** [app-links.ts](file:///home/antigravity/MuhammeDTayyiP0/geldesat.com/web/server/middleware/app-links.ts#L18-L26) hâlâ placeholder (`APPLE_TEAM_ID`, boş SHA-256) döndüğü için `/.well-known/*` 404 veriyor; mobilde `+native-intent.tsx` olmadığı için `geldesat://mesajlar/...`, `/category/...`, `/search` bağlantıları `+not-found` ekranına düşüyor.
  4. `app.json`'da `ACCESS_FINE_LOCATION` yokken `LocationPicker` `Accuracy.High` istiyor; `associatedDomains` apex alan adını (`geldesat.com`) içermiyor; `slug` hâlâ kişisel `"muhammed-tayyip"`.

### 4.4 Kod Sağlığı & Teknik Borç
- **Monolitik dosyalar:** `web/src/routes/mesajlar/$id.tsx` (1.641 satır), `mobile-app/src/app/mesaj/[id].tsx` (1.147 satır), `web/src/routes/ilan-ver.tsx` (1.046 satır), `web/src/components/admin/ui.tsx` (854 satır), `web/src/routes/ilan/$slug.tsx` (785 satır), `web/src/routes/search.tsx` (776 satır), `mobile-app/src/app/ilan-ver.tsx` (775 satır).
- **Yinelenen yapı:** `search.tsx` ile `category/$slug.tsx` paralel filtre/çekmece mantığı taşıyıp davranış olarak ayrışmış (kategori sayfasında aktif filtre çipleri ve mobil sıralama çekmecesi eksik). `locations.ts` ve `chat-shared.ts` web ve mobilde kopyalanmış ve şimdiden sapmaya başlamış.
- **Ölü kod & gereksiz bağımlılıklar:** `web/package.json`'da **17 kullanılmayan paket** (`vaul`, `zustand`, `react-hook-form`, `@tanstack/react-table`, `date-fns`, 8+ kullanılmayan `@radix-ui/*` paketi), `web/src/components/ui/` altında 12 kullanılmayan bileşen, `mobile-app`'te kullanılmayan `expo-system-ui` ve `catalog.siteSettings` / `useStyles`.
- **Feature flag temizliği:** `harita_v2`, `arama_v2`, `ilan_formu_v2`, `sohbet_v2` %100'de oturunca eski dallar (özellikle bozuk olan eski OSM iframe haritası) temizlenebilir.

---

## 5. Ürün ve Pazar Yeri Önerileri (Sahibinden / Letgo / Dolap Kıyaslaması)

GeldeSat'ın mevcut teknik temeli güçlü; aşağıdaki ürün hamleleri kullanıcı dönüşümünü ve elde tutmayı en hızlı artıracak adımlardır:

1. **İlan detayına doğrudan "Teklif Ver" düğmesi ekle (En yüksek ROI):**
   Teklif / karşı teklif altyapısı sohbette **zaten hazır**, ama ataş menüsünün içine gizli. İlan detay sayfasında "Mesaj Gönder" yanına "Teklif Ver" koymak (Letgo/Dolap modeli) alıcı-satıcı etkileşimini ciddi ölçüde artırır.
2. **Kayıtlı Arama & Fiyat Düşüşü Bildirimi ("Aramayı Kaydet / Fiyat Düşünce Haber Ver"):**
   Fiyat geçmişi (`listing_price_history`) ve push altyapısı zaten var. Favorideki ilanın fiyatı düştüğünde otomatik bildirim + belirli filtreye yeni ilan gelince bildirim, kullanıcıyı uygulamaya geri döndüren en güçlü döngüdür.
3. **Eksik kritik arama filtrelerini aç:**
   - **Mahalle filtresi** (ilan verirken zaten toplanıyor ve sunucu sorgusunda destekleniyor!)
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
   - İlan galerisinde web'de **tıklayarak/çift dokunarak yakınlaştırma (zoom)** (araç hasar/ekspertiz ve daire planı incelemesi için kritik)
7. **Satıcı verimliliği:** `"Benzer ilan ver"` (ilan kopyalama), ilan düzenlerken red gerekçesini doğrudan üst bantta görme, vasıta/emlak için yan yana **İlan Karşılaştırma**.

---

## 6. Önceliklendirilmiş Eylem Planı

| Faz | Odak | Başlıca İşler |
|---|---|---|
| **Faz A (Acil Düzeltmeler)** | Canlı kırıklar & kritik güvenlik | `verilerim.ts` SQL düzeltmesi + test; Admin `approve`/`activate` düzeltmesi; Better Auth `pg.Pool` error handler & paylaşımı; `TRUSTED_IP_HEADER` + sınırlı rate-limit; `/api/geo` kuyruk koruması; `ota.ts` host sabitlenmesi; `migrate.mjs` advisory lock; web `dropdown-menu`/shadcn token + `z-index` düzeltmesi; `/sayfa/yardim` → `iletisim`; mobil `api/mobile/favorites` unfavorite düzeltmesi; `adminBroadcast` `safeRedirect` + `adminDeletePage` koruması. |
| **Faz B (Tasarım & UX Cilası)** | Görsel kalite & son sohbet düzeltmeleri | Mobil `FilterSheet` iç içe Modal çözümü; Android `Sheet` klavye düzeltmesi; `SwipeToReply` ölü bölge + `pending` kilidi + `jumpTo` scroll + gelen kutusu `online` noktası; mobil `Toast`/`IconButton`/`RowGroup`/`giris` inset düzeltmeleri; web `top-24` → `top-28`, `BottomNav` `/ilan-ver` gizleme, koyu tema `::selection`/kategori tonları/tema seçici, para birimi birliği, `sifre-sifirla` hata toast'ı. |
| **Faz C (SEO, Admin & DevOps)** | Trafik, görünürlük & otomasyon | `sitemap-categories.xml` üst kategorileri dahil etme + `seo.ts` JSON-LD düzeltmeleri; GitHub Actions web+mobil CI; `/api/health` + Dockerfile `HEALTHCHECK`; Admin `client_errors` stack trace görüntüleyici, `lastCronRun`, `q.error && !q.data`, `moderasyon` mobil düzeni; kritik DB indeksleri ve transaction düzeltmeleri; `nav-data.ts` dinamikleştirme. |
| **Faz D (Mağaza & Gelir)** | Yayın & monetizasyon | Sign in with Apple; Android FCM `googleServicesFile`; `.well-known` + `+native-intent.tsx`; OTA kod imzası; gerçek Doping/Kredi/Ödeme akışı (web ödeme + mobil IAP kararı) veya `doping_enabled` sadeleştirmesi; mağaza başvuru & plan kuralları. |
| **Faz E (Ürün & Büyüme)** | Rekabet avantajı & ölçek | İlan detayda "Teklif Ver", kayıtlı arama & fiyat düşüşü bildirimi, mahalle/tarih filtreleri, canlı autocomplete, mobil harita, satıcı takip, ölü kod / kullanılmayan paket / oturan feature flag temizliği, büyümeye göre S3/R2 + Redis/LISTEN-NOTIFY hazırlığı. |
