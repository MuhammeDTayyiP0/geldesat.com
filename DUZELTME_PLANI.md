# GeldeSat düzeltme planı

Kaynak: `DENETIM_RAPORU.md`. Rapordaki her bulgu artık işaretlenebilir; "Madde N" Bölüm 1'i, "3.x" Bölüm 3'ü gösterir.

**İşaretler:** `[ ]` yapılacak, `[x]` bitti ve kontrolden geçti, `[~]` bilinçli olarak yapılmadı (yanına neden yazılır).

## Çalışma kuralları

1. Fazlar sırayla, tek yazar tarafından yapılır. Dosya çakışması olmasın diye paralel yazan ajan kullanılmaz.
2. Her paket bitince bu plan ve rapordaki satırlar işaretlenir. Bir satır, içindeki bulguların hepsi bitince işaretlenir.
3. Bulguya dokunmadan önce kod yeniden okunur. Bulgu yanlış çıkarsa `[~] yanlış pozitif` yazılır, düzeltme uydurulmaz.
4. Her faz sonunda: `tsc`, `eslint`, `DATABASE_URL=" " npm test`; mobilde `tsc`, `expo lint`. Tarayıcı ve geliştirme sunucusu açılmaz.
5. Her faz `master`'a ayrı commit olur. **Push ve OTA yalnız sen onaylayınca yapılır.**
6. Web ve mobil birlikte değişiyorsa önce web deploy edilir, sonra OTA gönderilir.
7. Güvenlik ve yetki düzeltmeleri anahtara bağlanmaz. Mesajlaşma ve ilan verme akışındaki büyük davranış değişiklikleri anahtar arkasına girer, eski kod saklanır.
8. Plan dosyası durumu tuttuğu için iş bölünebilir: yeni bir oturum kaldığı yerden devam eder. Oturum limiti için 1-2 fazda bir yeni oturum önerilir.

## Karar gerekenler

Onaylarsan bu varsayılanlarla ilerlerim. Değiştirmek istediğini söylemen yeterli.

| # | Karar | Varsayılan |
|---|---|---|
| K1 | Eski mobil REST uçları (`conversations*`, `blocks`, kullanılmayan `images` POST/DELETE, `my-listings` GET) | Mağazada bu uçları çağıran eski build yoksa 410 yap. Önce mevcut uygulamadaki kullanım tekrar taranır. |
| K2 | Satılan ilan alıcıya görünsün mü? | Görünsün: "Satıldı" rozetli, noindex; mobil API de açılır. Süresi dolan için de web ve mobil aynı kural. |
| K3 | Arşivdeki sohbete mesaj gelince | Arşivden çıksın (sunucu tarafında). Mesaj kaçmasın. |
| K4 | Harita | `/api/tiles` ile gerçek harita, şehir bazlı kümeleme ve sayı. Anahtar: `harita_v2`. |
| K5 | Arama | Eklentisiz: normalize edilmiş arama sütunu, kelime bazlı AND, kategori adı dahil. Anahtar: `arama_v2`. |
| K6 | iOS girişi | Apple ile giriş eklenir (Faz 14, mağaza sürümü). |
| K7 | OTA kod imzası | Aynı mağaza sürümünde eklenir. |
| K8 | Telefon doğrulaması | SMS sağlayıcı ücretli olduğu için şimdilik yalnız hız sınırı ve genel mesaj; SMS `[~]` kalır. |
| K9 | Mobil hata raporlama | Native paket eklemeden kendi `/api/mobile/client-errors` ucumuz (OTA ile gider). |
| K10 | Admin kademesi | Yeni rol yok. Rol değişiminde şifre doğrulaması ve transaction içinde son admin koruması. |
| K11 | Doping | Satış kapalıyken tüm girişler gizlenir; `doping_enabled` gerçekten bağlanır. |
| K12 | Mevcut çift puanlar | Satıcı+yorumcu başına en yeni puan kalır, diğerleri silinir. **Geri alınamaz; deploy öncesi yedek şart.** |
| K13 | Bekleyen 6 dosya ve `mobile/` silmesi | Faz 0'da kendi commit'lerine ayrılır (aşağıda). |

## Senin yapman gerekenler

- [ ] Deploy öncesi veritabanı yedeği (Faz 1'den önce).
- [ ] Coolify'da `CRON_SECRET` ve zamanlanmış görev.
- [ ] Proxy zincirini doğrulama: Cloudflare önde mi, Traefik hangi IP'ye güveniyor, 3000 portu dışarı açık mı? (Madde 14)
- [ ] `APPLE_TEAM_ID` ve Android SHA-256 parmak izi (Madde 44).
- [ ] Hukukçu ve mali müşavir: üyelik onay metni, KVKK aydınlatma dili, duyuru/ticari ileti, ödeme kaydı saklama süresi.
- [ ] Her deploy, OTA ve mağaza build onayı; admin panelinde anahtar ekleme ve yüzde ayarı.
- [ ] Planın sonundaki görsel kontrol listesi (ben ekrana bakmıyorum).

---

## Faz 0: Hazırlık

- [x] Satır sonu: `.gitattributes`'a `* text=auto eol=lf` eklendi, çalışma ağacı LF'ye çevrildi. 146 sahte değişiklik kalktı.
- [x] Gerçek değişiklikler ayrı commit'lendi: fotoğraf inceleme özelliği (`045cc37`), `.gitignore` ve yönergeler (`1ff8b7d`).
- [x] Eski `mobile/` silmesi ayrı commit (`8b4aa39`). `AGENTS.md`, `CLAUDE.md`, `YAPAY_ZEKA_YONERGESI.md`, rapor ve plan eklendi.
- [x] `web/.tanstack/` ve boş kök `package-lock.json` `.gitignore`'a alındı.
- [x] Mobil lint: Linux binding'i (lock'taki sürüm, integrity doğrulandı) `node_modules`'a açıldı; Windows binding'i duruyor. `expo lint` temiz.
- [x] Başlangıç: web `tsc` temiz, `eslint` 0 hata 12 uyarı, 33/33 test; mobil `tsc` ve `expo lint` temiz.

## Faz 1: Sunucu güvenliği ve veri bütünlüğü

Yalnız web, anahtarsız, her biri testli. Migration'lar `0032`'den başlar. **Faz sonunda ilk deploy noktası.**

- [x] Yönlendirme: `safeRedirect` kontrol karakteri ve origin, admin bildirim linki de aynı işlevle (Madde 4; `users.ts:406`).
- [x] `attrs`: regex, tanımlara göre doğrulama, uzunluk ve anahtar sınırı, `city/district` sınırı, Yıl aralığı (Madde 5; `listing-write.ts:15-20`).
- [x] Puan: benzersizlik, sahiplik, transaction, hız sınırı, temizleme migration'ı (Madde 3; K12).
- [x] Şikayet: mesaj şikayetinde ilan kaldırmama, `on delete set null`, içerik kopyası, görsel gösterimi, `message_id` tekilleştirme, karşı tarafa doğru sayım (Madde 6, 7; 3.5 Şikayetler).
- [x] Kredi: koşullu güncelleme, tekil indeks, negatif bakiye, büyük tutar onayı, kendine yükleme (Madde 15; 3.5 Kullanıcılar).
- [x] CSV formül kaçışı (`admin/search.ts`).
- [x] Telefon: `revealListingPhone` günlük tavan, kayıt sorgusunda hız sınırı (3.7; K8).
- [x] Kayıt `image` alan kontrolü, avatar ve yükleme boyut sınırları, `resizeVariant` piksel sınırı, RPC gövde limiti (3.4, 3.7).
- [x] `getStore` ve `getSiteSettings` herkese açık yanıtlarından telefon ve IBAN'ı çıkar; askıdaki mağazayı mobilde gizle (3.1, 3.4, 3.7).
- [x] Tiles ve geo: hız sınırı, seri kuyruk, istek birleştirme, `toFixed(3)` (3.3, 3.7).
- [x] OAuth `done` akışını `start`'a bağla, `no-store` (3.7).
- [x] IP anahtarı için `TRUSTED_IP_HEADER` ve gerçek 429 eklendi. **Senden bekliyor:** proxy zincirini doğrulayıp değişkeni Coolify'a girmek (Madde 14).
- [x] Engel varken presence ve yazıyor sinyali, `respondOffer` denetimleri (3.3).
- [x] Sohbetten silinen içerik bildirimden de silinsin (3.3).
- [x] Oturum ömrü (60-90 gün) ve push token'ının oturum ve hesap kapanışında silinmesi (Madde 12; 3.7).
- [x] K1 kararına göre eski REST uçları; okundu sızıntısı, bildirim yağmuru ve EXIF açığı bununla kapanır (Madde 10; 3.7).
- [x] `db.ts`: bağlantı ve sorgu zaman aşımı; `errors.ts`: yalnız `PublicError` gösterimi.
- [x] Testler: durum geçişi, `attrs`, puan benzersizliği, yönlendirme.

## Faz 2: İlan durum modeli

Tek kaynak: sunucuda geçiş tablosu ve ortak "canlı" SQL parçası. Birçok bulgunun kök nedeni.

- [x] `lib/server/listing-status.ts`: izinli geçişler ve bunlardan türeyen eylem listesi; web ve mobil yanıtına eklenir.
- [x] Moderasyon atlatma ve `attrs` değişiminin incelemeye girmesi (Madde 1; 3.2).
- [x] `first_free` için kalıcı profil alanı ve backfill (Madde 2).
- [x] Uzatma durumu değiştirmesin, süresi dolmuş yayına alınamasın, sunucu reddetsin (Madde 30).
- [x] Toplu onay `PENDING` koşulu, askı kontrolü, atlananların sayısı; tüm admin kararları koşullu (Madde 9; 3.5).
- [x] `status_before_ban` temizliği ve geri yüklemede durum koşulu (Madde 8).
- [x] "Canlı" SQL'i dashboard, kullanıcı, mağaza, ilan ve şikayet sayılarına uygula (3.5).
- [x] Satılan ilan görünürlüğü ve metinleri (K2; 3.2); son bakılanlarda reddedilen ilan maskeleme.
- [x] Sahip bildirimi, admin onayında süre yenileme, transaction'lar (3.2, 3.7).
- [x] Admin'in site üzerinden yaptığı işlemlere audit ekle (3.5).
- [x] Geçiş tablosu testleri.

## Faz 3: Web ortak altyapı

Sonraki fazlar bunları kullanır.

- [x] Router `remountDeps`; ilan ve sohbet state taşınması, galeri çökmesi (Madde 16).
- [x] Türkçe hata ekranı, yeniden dene ve ana sayfa (Madde 37).
- [x] Zod hatası normalize, şemalara Türkçe mesaj; `validationMessage` ortak (Bölüm 2.6).
- [x] `translateAuthError` web'e; `?error=` okuma; "Unauthorized" (Madde 38).
- [ ] Ortak `ErrorState`, sayfalama ve seçim yardımcıları, `useDirtyGuard`, `FieldGroup`, erişilebilir `Drawer` (Bölüm 2.4, 2.14; Madde 36).
- [x] `useCurrentUser` kararlı hâle getirildi; sekme dönüşünde ekranlar yeniden yüklenmiyor (Bölüm 2.5; mağaza formu veri kaybı).
- [x] Tema: `text-subtle`, koyu `primary`, `ok`, `urgent`, `violet` token'ları; `text-ink`/`bg-ink` kullanımı, logo (Madde 39; Bölüm 2.13).
- [x] `<Link><Button>` için `buttonVariants`/`asChild`, iç içe `<main>`, "İçeriğe atla", `dialog.tsx` "Kapat".

## Faz 4: Web vitrin, arama, SEO (rapor 3.1)

- [x] `parseSearch` sayısal değerler, geçersiz `sort`/`page` normalize, bilinmeyen kategoride boş sonuç (Madde 17, 19, 37).
- [x] Filtre paneli: stale `initial`, sayfalama URL'den, gizli filtre temizliği, Enter ve aralık, kilit (Madde 18).
- [~] Ortak `CatalogPage` birleştirmesi yapılmadı: ekrana bakmadan 1200 satırı birleştirmek riskli. Sayfalama ortak `Pagination` oldu, kategori boş durumu düzeldi. Görsel kontrol sonrası ayrı iş.
- [x] Menüyü kategori ağacından besle; ölü linkler, `/sayfa/yardim`, `NotFound` slug'ları; menü `/category/$slug`'a gitsin (Madde 19).
- [x] Navbar erişilebilirliği, `SearchBar` combobox, drawer, `redirect`, `initialQuery`, `styles.css` düzeltmeleri.
- [x] SEO başlık üretimi, ilansız kategori noindex, sitemap `lastmod`, boş sitemap, OG etiketleri, şema düzeltmeleri (Madde 43).
- [x] Ana sayfa: `scrollRestoration`, akış sırası, `priority`, konum hata metni.
- [x] Satıcı sayfası sayfalama, yorumlar, sekme (Madde 42).
- [x] Yasal sayfa ayrıştırıcısı ortak, `updated_at`, gerçek tarih, yalnız yasal sayfada not.
- [x] `arsiv` route'unu sil; doping girişlerini gizle (K11); Cookie banner; Footer; ListingCard.
- [x] `harita_v2` (K4; Madde 40) ve `arama_v2` (K5; Madde 41).

## Faz 5: Web ilan akışı (rapor 3.2)

- [x] Galeri ve lightbox: dialog, küçük resim kaydırma, jest, `srcSet`.
- [x] Yıl biçimi, birim, iskelet, Sahip paneli çıkmazları (Madde 24).
- [x] Doğrulamayı adımlara taşı: fiyat, telefon, zorunlu özellikler, trim; `Number("")` (3.2).
- [x] Profil telefonu override yazmasın (web ve mobil birlikte).
- [x] Düzenlemede yeniden inceleme uyarısı; kategori değişiminde değer koruma; mağaza kimliği.
- [x] Taslak: otomatik kayıt, adım URL'de, çıkış uyarısı, sürükle-bırak koruması. Anahtar: `ilan_formu_v2` (Madde 29).
- [x] Görsel hattı: JPEG çift sıkıştırma, HEIC başlık sınırı.
- [x] İlanlarım, favoriler, son bakılanlar: hata durumu, sayfalama, `listingSelect`, rozetli ve soluk satırlar, tutarlı giriş akışı.

## Faz 6: Web hesap ve ayarlar (rapor 3.4)

- [x] Giriş: Google hata yolu, doğrulama geri bildirimi, onay kaydı (sürüm ve tarih), şifre göster, oturumlu yönlendirme (Madde 38).
- [x] Sıfırlama postasını arka plana al, SMTP zaman aşımı, süresi dolan token yolu.
- [x] Tüm ayar sayfalarında hata durumu; `hasPassword` hata davranışı; mağaza formu telefon ve il önerisi.
- [x] KVKK dışa aktarım tamamlama ve indirme hatası (`verilerim.ts`).
- [x] Avatar tek kaynak, `phone-input` `maxLength`, `settings.ts` şifre sınırı, tarih ISO.
- [x] E-posta değiştirme, tek cihaz kapatma, Türkçe metin ve terim birliği, radyo klavye desteği.

## Faz 7: Mesajlaşma sunucu ve web (rapor 3.3)

- [~] `mesajlar/$id.tsx` bölünmedi: davranış değiştirmeyen bir iş, ekrana bakmadan 1600 satırı taşımak gereksiz risk. Görsel kontrol sonrası ayrı iş; sınırlar raporda.
- [x] Dolandırıcılık regex'i, testli, web ve mobil (Madde 22).
- [x] Görünürlük: gizli sekme "izliyor" sayılmasın, pencere okununca sıfırlansın (Madde 20).
- [x] `pollThread` değişenleri getirsin; `message_update` yalnız var olanı güncellesin; kaçan olay telafisi.
- [x] Tek rozet fonksiyonu: arşiv, gizli, bildirim çifti (Bölüm 2.12). Arşiv kararı (K3).
- [x] Süpürme tekrarları: `expiry_notified_at` (Madde 23); push arka plana; `broadcast` ve ölü token ortak.
- [x] Web sohbet: sıralama, ilk okunmamış, yeni mesaj düğmesi, başarısız fotoğraf, arama debounce, geri dönüşte önce çekme. Anahtar: `sohbet_v2`.
- [x] Küçükler: Enter, pano, sürükle-bırak, menü `catch`, arşiv etiketi, hızlı yanıt, kontrast, `LocationPicker` yer adı.
- [x] Bildirim sayfası: hata, canlılık, sayfalama, başlıkta gönderen.

## Faz 8: Admin (rapor 3.5, 3.6)

- [x] `FieldGroup` geçişi, kaydedilmemiş korumaları, seçim sıfırlama, taşan sayfa, `q.error && !q.data`.
- [x] Moderasyon kısayolları: `A` kilidi (Madde 9), ret modu, Esc, mobil düzen.
- [x] İlan işlemleri: fiyat doğrulama, sıra (audit önce, bildirim arka planda), gerekçe, bildirim, taşıma uyarısı, doğru metinler.
- [x] Kullanıcılar: rol koruması (K10), bootstrap, not ayrı işlev, silinme iptali.
- [x] Yorum genişletme, mağaza kapanış bildirimi, boş durumlar, kayıt filtresi, audit önce/sonra (Bölüm 2.15).
- [x] Zorunlu güncelleme mobilde gerçekten çalışsın (Madde 33; mobil kısmı Faz 10).
- [x] `homeSections` ana ekrana bağlansın; `doping_enabled`, `mobile_bottom_nav` bağlansın; panelde kullanılmayan anahtar uyarısı (Madde 34).
- [x] OTA: mağaza sürümüne dönüş iki platforma (Madde 35), %100 onayı, platform bazlı "Yayında", `critical`, audit, `ota_assets` temizliği, async gzip.
- [x] Kategori: toplu aktarım onayı, özyinelemeli sıralama, döngü koruması, 301 için slug geçmişi.
- [x] Sayfalar: bağlı adres kilidi, sürüm geçmişi, ortak önizleme. Duyurular: tercih türü, arka plan işi, doğru sayaç.
- [x] Finans ve sistem: görev sonuçları, cron son çalışma, boş durumlar. Çerez `gs-uid` kapsamı.

## Faz 9: Kalan sunucu ve performans (rapor 3.7)

- [x] İndeksler: `phone_reveals`, `created_at`, örtüşen `messages` indeksleri; `listing_no` sorguları.
- [x] Sayfalama ve `listingSelect` (favoriler, ilanlarım, sohbet); `String(Date)` yerine `asIso`.
- [x] Mobil API uyumu: `legacy_slug`, `show_whatsapp`, `has_phone`, süresi dolmuş kuralı (Madde 11).
- [x] Küçük API düzeltmeleri: `limit=abc`, 400/500, kısmi profil, tanınmayan `action`, geo parametresi.
- [x] Test kapsamı: RPC izin listesi, OAuth, `searchListings`.
- [ ] **Deploy noktası:** Mobil fazlardan önce web canlıda olmalı.

## Faz 10: Mobil temel (rapor 3.11)

Hepsi JS; `expo.version` değişmez, OTA ile gider.

- [x] `ErrorBoundary`, açılışta saklı oturumla hemen açılma, tüm `auth.ts` isteklerinde zaman aşımı (Madde 25).
- [x] Hata raporlama ucu (K9).
- [x] Zorunlu güncelleme ekranı (Madde 33), `homeSections` kullanımı.
- [x] Tek `endSession`: push, önbellek, taslak, aramalar; çıkış önce yerel (Madde 12; Bölüm 2.8).
- [x] `ayarlar` için oturum koruması; `isError && !data` ortak kalıbı.
- [x] `Sheet` klavye, `onDismissed` kuralı, modal içi hata gösterimi (Bölüm 2.10).
- [x] `Input`, `Switch`, `ListRow`, `Toast`, `Stars` erişilebilirliği; hedef boyutları; `minHeight`; `insets.bottom`; tema token'ları.
- [x] `scripts/ota-publish.mjs` native değişiklik koruması.

## Faz 11: Mobil keşif (rapor 3.8)

- [ ] Kalp ve önbellek anahtarı, giriş sonrası yenileme (3.8 Y).
- [ ] WhatsApp, "Ara" koşulu, eski slug, yıl biçimi (Madde 11, 24).
- [ ] Ara ızgarası, odak, ilan no araması, kategori hataları (Madde 45).
- [ ] Sonuçlar: görünmez filtre, tekilleştirme, sonraki sayfa hatası, liste performansı.
- [ ] Teklifin mesajsız sohbet açması, durum çubuğu, `Share`, sahip paneli ve fiyat geçmişi uyumu.
- [ ] Satıcı sayfalama, 404 durumları, favori ve son bakılan düzeltmeleri, `links.ts` eşlemeleri.
- [ ] Erişilebilirlik: iç içe Pressable kalıpları; koyu tema ikon renkleri.

## Faz 12: Mobil ilan verme (rapor 3.9)

- [ ] Taslak: dismiss silmesin, hydrate kilidi, hesap ayrımı, 24 saat kontrolü (Madde 26, 28).
- [ ] Android geri tuşu, `getPendingResultAsync`, idempotency anahtarı (sunucu dahil).
- [ ] Kategori ve özellik hata durumları, telefon ve fiyat sınırı, yıl aralığı, metinler.
- [ ] `PhotoStep` araç düzeni, hata gösterimi, yükleme iptali, iOS galeri izni.
- [ ] İlanlarım: durum eylemleri Faz 2 listesinden, "Satıldı" onayı, önbellek, web uyumu.
- [ ] Hazır mesajlar: hata, kayıt güvenliği (Madde 27).

## Faz 13: Mobil mesajlaşma ve hesap (rapor 3.10, 3.11)

- [ ] Yeniden bağlanmada ve ön plana dönüşte telafi, 30 sn yoklama, heartbeat (Madde 21).
- [ ] Odak: `useIsFocused` ile okundu ve akış (Madde 21).
- [ ] İyimser gönderim, yeniden deneme, istemci mesaj kimliği, fotoğraf hatası. Anahtar: `sohbet_v2`.
- [ ] Liste: yerel gün ayrımı, hedefe kaydırma, okunmamış ayracı, konum koruma, composer ayrımı.
- [ ] Balon: uzun basma (Madde 32), bilgi menüsü, ekran okuyucu eylemleri, teklif kartı kontrastı, sabit renkler.
- [ ] Sekme: sheet kuralı, ön planda yenileme, rozet, kaydırma kontrastı. Push izni dönüşü.
- [ ] `LocationPicker`: yer adı, klavye, Leaflet paketleme.
- [ ] Hesap: silme akışı ve banner (Madde 13), `Verilerimi indir` (Madde 31), "Üye ol" modu, avatar seçimi, açık oturumlar, gizlilik uyumu, tercih yarışı.
- [ ] **OTA noktası:** önce `--channel preview` veya `--rollout 10`.

## Faz 14: Mağaza sürümü

Yönerge bölüm 5. Faz 13 yayınlanıp oturmadan yapılmaz; `version` artınca eski OTA'lar yeni build'e, yenileri eski build'e gitmez.

- [ ] Apple ile giriş (K6).
- [ ] `.well-known` dosyaları (Faz 1 sonrası web tarafı hazır, senin değerlerinle), `associatedDomains`, Android filtresi (Madde 44).
- [ ] OTA kod imzası (K7).
- [ ] `expo.version` 1.1.0, ilgili anahtarlarda `minAppVersion`, `npx eas-cli@latest build --profile production`.

## Faz 15: Kapanış

- [ ] Ölü kod ve kalıntı yorumlar; rapordaki kalan `[ ]` satırları tek tek bitir veya `[~]` nedeniyle kapat.
- [ ] Tüm kontroller ve `[~]` listesinin özeti.
- [ ] Anahtarlar %100'de oturunca eski kodu kaldırma (senin isteğinle).

## Görsel kontrol listesi

Her deploy sonrası sana sorarım: koyu temada logo ve çipler; üst menünün yapışması; küçük telefonda filtre çekmecesi; harita; 360dp Android Ara ekranı; ortadaki fotoğrafın Sil düğmesi; iOS'ta klavye üstünde silme onayı; iOS'ta giriş ekranından yasal metin; Android'de Google girişi dönüşü.
