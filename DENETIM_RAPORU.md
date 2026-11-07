# GeldeSat proje denetimi

İlerleme `DUZELTME_PLANI.md` ile izlenir. `[x]` bitti, `[~]` bilinçli olarak yapılmadı.

Tarih: 7 Kasım 2026. Çalışma ağacının commit'lenmemiş hâli incelendi. 11 ajan salt okunur çalıştı, kodda değişiklik yapılmadı.

**Yollar:** aksi yazmıyorsa `W/` = `web/src/`, `M/` = `mobile-app/src/`.
**Önem:** K Kritik, Y Yüksek, O Orta, D Düşük. "(olası)" kod izlenerek çıkarıldı ama çalışırken doğrulanmadı veya ortama bağlı.

## Bu raporun sınırları

- Hiçbir ekran açılmadı (proje kuralı). Tasarım, kontrast ve yerleşim bulguları koddan çıkarıldı; cihazda ve tarayıcıda bakılmalı.
- Canlı veritabanına bağlanılmadı. Kategori ve sayfa slug'ları `web/migrations/` üzerinden kontrol edildi; admin panelinden eklenenler sonucu değiştirebilir.
- Üretim proxy zinciri (Cloudflare/Traefik) görülmedi; IP'ye bağlı bulgular buna göre okunmalı.
- Bölüm 1'deki 45 maddeden 35'ini ana oturumda kodla yeniden kontrol ettim. 12, 14, 21, 28, 29, 38, 40, 41, 42 ve 44 yalnız ajan bulgusudur. Bölüm 3 de ajan bulgusudur, tek tek yeniden doğrulanmadı.
- Bir ajan, üretimdeki iki herkese açık `.well-known` adresine salt okunur GET isteği attı. Başka canlı erişim yok.
- Mağaza kuralları (Apple 4.8) bellekten yazıldı; güncel metne bakılmalı. Hukuki maddeler (KVKK, ticari ileti, mali kayıt saklama) danışmana doğrulatılmalı.

## Temel kontroller

| Kontrol | Sonuç |
|---|---|
| Web `tsc --noEmit` | Temiz |
| Web `eslint src` | 0 hata, 12 fast-refresh uyarısı |
| Web `npm test` (`DATABASE_URL=" "`) | 33/33 geçti |
| Mobil `tsc --noEmit` | Temiz |
| Mobil `expo lint` | **Çalışmadı:** `unrs-resolver` native binding bulunamıyor. Mobil kod şu an lint'ten geçmiyor. |

Temiz çıkan alanlar: admin server fonksiyonlarının tamamı yetki kontrollü (57+), SQL injection bulunmadı, RPC izin listesi güvenli, OAuth PKCE doğru, sohbet ve görsel erişim kontrolleri doğru, statik sayfalarda XSS yok, OTA publish token ve hash kontrolü doğru, özellik anahtarı yüzde hesabı doğru.

---

## 1. Öncelik listesi

### Güvenlik ve bütünlük

- [x] 1. **K · Moderasyon atlatma.** Onaylı ilan SATILDI yapılır, içeriği tamamen değiştirilir, sonra "Tekrar yayına al" ile incelemesiz yayına girer. `reReview` yalnızca ACTIVE/INACTIVE için çalışıyor. `W/lib/server/listing-write.ts:120`, `W/lib/server/account.ts:142`, `W/routes/api/mobile/my-listings/$id.ts:52` → `reReview`'i durumdan bağımsız yapıp `approved_at=null` yaz.
- [x] 2. **Y · Otomatik onay istismarı.** `first_free` mevcut ilan sayısına bakıyor, silme kalıcı. İlanı silip yenisini veren her seferinde otomatik onay alır. `listing-write.ts:145-146` → "daha önce onaylı ilanı oldu" bilgisini profilde kalıcı tut.
- [x] 3. **Y · Puan manipülasyonu.** `leaveReview` ilanın satıcıya ait olduğunu denetlemiyor, tekillik satıcı+yorumcu+ilan üçlüsünde. Tek sohbetle aynı satıcıya sınırsız puan yazılır. Hız sınırı da yok. `W/lib/server/social.ts:106-131` → `unique(seller_id, reviewer_id)`, sahiplik kontrolü, temizleme migration'ı.
- [x] 4. **Y · Açık yönlendirme.** `/login?redirect=/%09/evil.com` korumayı geçiyor ve `https://evil.com/` olarak çözülüyor (Node `URL` ile denendi, tarayıcıda denenmedi). `W/lib/auth/sign-in-gate.ts:17` → kontrol karakterlerini reddet, origin karşılaştır, teste ekle.
- [x] 5. **Y · Aramayı kilitleme.** Regex `^[0-9.]+$` "1.2.3" değerini geçirir, `::numeric` hata verir; `attrs` sunucuda doğrulanmıyor. Özel istekle yazılan tek değer KM, Yıl ve m² filtreli aramaları hataya düşürür. `W/lib/server/catalog.ts:132`, `listing-write.ts:20` → regex'i düzelt, `attrs`'ı tanımlara göre doğrula, boyut sınırı koy.
- [x] 6. **Y · Mağdur cezalandırma.** Mesaj şikayeti de `listing_id` taşıyor. "Kapat + ilanları kaldır" şikayet edenin kendi ilanını reddedebilir. `W/lib/server/admin/moderation.ts:155-162`, `W/lib/server/chat.ts:551` → kaldırmayı `conversation_id is null` ile sınırla.
- [x] 7. **Y · Şikayet kanıtı kayboluyor.** Şikayet ilana `on delete cascade` ile bağlı (0026 yalnızca NOT NULL'u kaldırıyor); şikayet edilen satıcı ilanı silince şikayet de silinir. Şikayet ekranı yalnız son 12 mesajı gösterir, "herkesten sil" içeriği kalıcı siler. `web/migrations/0002_schema.sql:120`, `moderation.ts:62-65`, `chat.ts:274-279` → `set null`, şikayet anında içerik kopyası.
- [x] 8. **Y · Reddedilen ilan askı kalkınca yayına dönüyor.** Admin reddi `status_before_ban`'ı temizlemiyor. `W/lib/server/admin/users.ts:288`, `W/lib/server/admin/listings.ts:292` → her admin durum değişikliğinde sıfırla.
- [x] 9. **Y · Onay denetimsiz.** Toplu onay kaynak durumu ve satıcı askısını kontrol etmiyor: "Tümü"nden seçilince SATILDI, REDDEDİLDİ ve askıdaki satıcının ilanları yayına girer. `listings.ts:282-305` → `status='PENDING'` koşulu. Ayrıca `A` kısayolu `e.repeat` ve yükleme kontrolü yapmıyor; basılı tutmak sıradaki ilanı görmeden onaylar. `W/routes/admin/moderasyon.tsx:141-143`.
- [x] 10. **Y · Okundu gizliliği sızıyor.** Eski REST ucu `read_receipts` ayarına bakmadan `read_at` döndürüyor ve yayınlıyor. Mevcut uygulama bu ucu çağırmıyor, ama açık. `W/routes/api/mobile/conversations/$id.ts:23-41` → RPC mantığını uygula veya uçları kapat.
- [ ] 11. **Y · Satıcının WhatsApp ayarı uygulamada geçersiz.** "WhatsApp ile yaz" her zaman görünüyor, mobil API `show_whatsapp` döndürmüyor. `M/features/listing/ListingSheets.tsx:122`, `W/routes/api/mobile/listings/$id.ts` → alanı ekle, koşula bağla; web önce deploy edilmeli.
- [ ] 12. **Y · Oturumu kapanmış telefona mesaj push'u.** 401'de, çevrimdışı çıkışta ve hesap silmede sunucudaki token kalıyor; şifre değişse bile çalınan telefon mesaj önizlemesi alır. `M/api/client.ts:68-70`, `M/lib/push.ts:47-48`, `M/app/ayarlar/guvenlik.tsx:125,159` → oturum kapanışında sunucuda sil, token'ı oturuma bağla.
- [ ] 13. **Y · Hesap silme metni yanlış, veri kaybına yol açabilir.** Mobil "giriş yaparak geri alabilirsiniz" diyor; giriş geri almıyor, açık `restoreMyAccount` gerekiyor ve düğme yalnız Şifre ve güvenlik içinde. Kullanıcı geri aldığını sanar, 30 gün sonra veri silinir. `M/app/ayarlar/guvenlik.tsx:126,172`, `W/lib/server/settings.ts:132` → belirgin banner ve doğru metin.
- [ ] 14. **Y (olası) · IP tabanlı sınırlar.** `x-forwarded-for` ilk değerine dayanıyor; proxy'ye göre sahtelenebilir veya herkes aynı IP'yi paylaşıp haksız 429 alabilir. `W/lib/server/helpers.ts` `viewerKey`, `web/docker-compose.yml:27` → gerçek zinciri doğrula, güvenilir tek kaynak kullan, portu kapat.
- [x] 15. **O · Kredi çift yükleme.** Durum transaction dışında okunuyor, `update` koşulsuz. Satış şu an kapalı, açılmadan düzeltilmeli. `W/lib/server/admin/business.ts:195-202`.

### Kullanıcı akışını bozan hatalar

- [x] 16. **Y · İlan ve sohbet state'i taşınıyor.** Route'ta `remountDeps` yok. 6. fotoğraftayken 3 fotoğraflı benzer ilana geçmek sayfayı hata ekranına düşürür (`photoSrc(undefined)`). Sohbette taslak, seçili fotoğraf ve yanıt başka kişinin sohbetine taşınır; IBAN veya özel fotoğraf yanlış kişiye gidebilir. `W/components/listing/ListingImageGallery.tsx:13,161`, `W/routes/mesajlar/$id.tsx:136,142,158` → `remountDeps` tek satırda ikisini de büyük ölçüde çözer.
- [x] 17. **Y · Sayısal URL parametreleri yok sayılıyor.** Router `?page=2` değerini sayıya çeviriyor, `str()` yalnız string kabul ediyor. Dış linkler bozuk, `rel=next` ve canonical 1. sayfayı döndürür, arama motoru derin sayfaları göremez. `W/lib/search-params.ts:64`, `W/lib/seo.ts:189-205` → `str()` sayıyı `String()` ile kabul etsin, test ekle.
- [x] 18. **Y · Uygulanan filtre geri alınıyor.** `closeFilterDrawer` 280 ms sonra eski `initial`'ı yazıyor; hızlı yanıtta panel eski değerlere döner, sonraki sayfada filtre URL'den silinir. `W/routes/search.tsx:155-161`.
- [x] 19. **Y · Ölü kategori linkleri tüm ilanları gösteriyor.** `projeler`, `ozel-araclar`, `elektronik`, `ev-yasam`, `oto-parca`, `moto-ekipman`, `tadilat`, `sektorler`, `evcil-hayvan` migration'larda yok; bilinmeyen kategoride filtre atlanıyor. 404 sayfasındaki `ikinci-el-ve-sifir-alisveris`, `ustalar-ve-hizmetler` ve menüdeki `/sayfa/yardim` da yok. `W/components/navbar/nav-data.ts`, `W/lib/server/catalog.ts:106-113`, `W/components/common/NotFound.tsx:32-33`, `W/components/navbar/MobileNavigationDrawer.tsx:268` → canlıda kontrol et, menüyü kategori ağacından besle, bilinmeyende boş sonuç dön.
- [x] 20. **Y · Bildirimler kayboluyor.** Arka planda açık sekme "sohbeti izliyor" sayılıyor; push, zil ve e-posta kesiliyor. 2 dakikalık pencere okununca sıfırlanmıyor, hızlı yazışmada yanıt sessiz kalır. `W/lib/server/chat.ts:103`.
- [ ] 21. **Y · Mobilde mesaj kaçıyor ve yanlış okundu.** Ön planda bağlantı kopup gelince telafi yok, yoklama yok; arkada kalan sohbet ekranı mesajları okundu yapıp push'u bastırıyor. `M/features/chat/stream.ts:32`, `M/app/mesaj/[id].tsx:89,162-173,183`.
- [x] 22. **Y · Dolandırıcılık uyarısı çalışmıyor.** `\b` Türkçe harfleri tanımıyor, ekleri kaçırıyor. Denenen 9 ifadeden 7'si yakalanmadı: "ön ödeme yapın", "ödeme linki atıyorum", "kaporayı gönder", "kaporası lazım", "önödeme lazım", "paparaya at", "whatsapptan yaz". `W/lib/chat-shared.ts:68-70`, `M/features/chat/shared.ts:31,34` → Unicode sınırı, ek toleransı, test.
- [x] 23. **Y · Tekrarlayan hatırlatma push'u.** Tekrar önleme `notifications` satırına bakıyor; `expiry` için uygulama içini kapatıp push'u açık bırakan kullanıcıda satır yazılmıyor, her süpürmede yeniden push gider. `W/lib/server/ops.ts:17-21`, `helpers.ts` `notify` → `listings.expiry_notified_at`.
- [x] 24. **Y · Model yılı "2.018" görünüyor.** Web detay ve kart, mobil kart ve detay. `W/components/listing/detail/ListingSections.tsx:140`, `W/lib/utils.ts:49`, `M/features/listing/ListingCard.tsx:26`, `M/app/ilan/[id].tsx:242`.
- [ ] 25. **Y · Uygulama açılışı kırılgan.** Açılış ekranı zaman aşımı olmayan `get-session` isteğini bekliyor; hiç `ErrorBoundary` yok, hatalı OTA uygulamayı tümden kapatır, hata raporlama da yok. `M/app/_layout.tsx:24-34`, `M/auth/auth.ts:154`.
- [ ] 26. **Y · Android taslak siliniyor.** Devam diyaloğunun dışına dokunmak veya geri tuşu onaysız `clearDraft()` çalıştırır. `M/ui/dialogs.ts:28`, `M/app/ilan-ver.tsx:125`.
- [ ] 27. **Y · Hazır mesajlar silinebilir.** Liste yüklenemezken boş görünür, yeni ekleme tüm listenin üstüne yazar. `M/app/ayarlar/sablonlar.tsx:14-16,54`.
- [ ] 28. **Y · 24 saatlik taslak fotoğrafı.** Sunucu bağlanmamış fotoğrafı 24 saatte siliyor; taslak bunu bilmiyor, Yayınla hangisi olduğunu söylemeden hata verir. `M/app/ilan-ver.tsx:123`, `W/lib/server/upload.server.ts:15-19`.
- [x] 29. **Y · Web'de taslak yok.** Yenileme veya geri tuşu tüm ilan formunu siler. `W/routes/ilan-ver.tsx:123-134`.
- [x] 30. **Y · "Süreyi uzat" gizli ilanı yayına alıyor.** Satıcının bilerek kapattığı ilan ve telefonu sessizce yayına döner; süresi dolmuş ilanda "Yayına al" başarı der ama ilan görünmez. Web ve mobil. `listing-write.ts:36-39`, `W/routes/ilanlarim.tsx:274-288`, `M/app/ilanlarim.tsx:167-174`, `W/routes/api/mobile/my-listings/$id.ts:51-55`.
- [ ] 31. **Y · KVKK bağlantısı yanlış.** "Verilerimi indir" `/ayarlar/gizlilik`'i açıyor, indirme `/ayarlar/hesap` sayfasında. `M/app/ayarlar/gizlilik.tsx:77`.
- [ ] 32. **Y · Fotoğraf balonunda menü açılmıyor.** İç `Pressable` uzun basmayı yutuyor; yanlış fotoğrafı silmek veya bildirmek pratikte erişilemez. `M/features/chat/Bubble.tsx:81,115,166`.

### Yönetici yanıltan ayarlar

- [ ] 33. **Y · Zorunlu güncelleme çalışmıyor.** "Altındaki sürümler güncellemeye zorlanır" yazıyor; mobil bu alanları yalnız tipte tutuyor. `W/routes/admin/ayarlar.tsx:398`, `M/api/types.ts:274`.
- [ ] 34. **O · Etkisiz ayarlar ve anahtarlar.** Mobil ana sayfa bölümleri (`homeSections`) yalnız tipte; `doping_enabled`, `mobile_bottom_nav` görünüyor ama kodda hiçbir `useFlag` çağrısı yok (web ve mobil). `W/routes/admin/ayarlar.tsx:337`, `W/lib/server/config.ts:8`.
- [x] 35. **Y · Mağaza sürümüne dönüş eksik platforma gidebilir.** Metin "tüm telefonlar" diyor, istek `u.platforms` gönderiyor. Yalnız Android satırından tetiklenirse iOS bozuk kodda kalır. `W/routes/admin/guncellemeler.tsx:71`.
- [x] 36. **O · `Field` label hatası.** Buton grubunu saran `<label>`: etikete veya boşluğa tıklamak ilk butonu tetikler. Duyuruda kitle "Tüm üyeler" olur, anahtar yüzdesi sessizce %0'a düşer. `W/components/admin/ui.tsx:315`, `ayarlar.tsx:212,242`, `duyurular.tsx:62`, `ozellikler.tsx:254` → `FieldGroup`.

### Görünür kalite, SEO ve mağaza

- [x] 37. **Y · Hata ekranı İngilizce ve ham.** "Something went wrong" ile `error.message` gösteriyor, çıkış yolu yok, sabit `zinc` renk kullanıyor. `?sort=foo` ile herkes tetikleyebilir. `W/lib/error-component.tsx`, `W/lib/search-params.ts:113-114`.
- [x] 38. **Y · Giriş hataları İngilizce, Google hatası sessiz.** "Invalid email or password" doğrudan görünüyor; mobilde çeviri var, web'de yok. Bağlanamayan Google hesabı mesajsız ana sayfaya düşer. `W/routes/login.tsx:42-50,72`, `W/routes/sifre-sifirla.tsx:65,109`, `W/lib/auth/server.ts:57`.
- [x] 39. **Y · Koyu temada logo görünmüyor.** `text-ink` koyu temada `#05070a`. `W/components/Navbar.tsx:178`, `MobileNavigationDrawer.tsx:68` → `text-brand` veya `text-fg`.
- [x] 40. **Y · Harita pinleri yanlış.** Aynı şehirdeki ilanlar tam üst üste, yalnız 24 ilan; pinler iframe üstüne doğrusal yüzdeyle konuyor, kaydırınca yerinde kalıyor. `W/routes/harita.tsx:37-41,60-69` → `/api/tiles` ile gerçek harita ve kümeleme.
- [x] 41. **Y · Arama kalitesi düşük.** Tek parça `ILIKE`; kelime bölme, Türkçe karakter eşleme ve kategori adı yok. "Honda Civic" sırası tutmazsa, "kiralik" hiç bulunmaz. `W/lib/server/catalog.ts:85-105`.
- [x] 42. **Y · Satıcı sayfası 24 ilanda duruyor.** "İlanlar (100)" yazarken 76 ilana ulaşılamıyor; web ve mobil. Yorumlar da 20'de kesiliyor. `W/routes/satici/$id.tsx:23,223`, `W/routes/api/mobile/sellers/$id.ts:32`, `W/lib/server/account.ts:342`.
- [x] 43. **O · Sitemap `lastmod` geçersiz.** `String(Date).slice(0,10)` "Sat Nov 07" üretir; `timestamptz` için parser yok. `web/server/middleware/seo.ts:206`, `W/lib/db.ts:107-109` → canlı sitemap'ten doğrula, `TO_CHAR`.
- [ ] 44. **Y · Mağaza riski (olası).** iOS'ta Google girişi var, Apple ile giriş yok (native değişiklik ve mağaza sürümü gerekir). `.well-known` dosyaları üretimde 404, paylaşılan ilan linkleri uygulamayı açmaz. `M/app/giris.tsx:198`, `mobile-app/app.json:23,40-50`, `web/server/middleware/app-links.ts:18`.
- [ ] 45. **Y · 360dp Android'de Ara ızgarası tek sütuna düşüyor (olası).** `width: 48.8%` + `gap: 8` sığmıyor. `M/app/(tabs)/ara.tsx:165,175`.

---

## 2. Birden çok yeri etkileyen kök nedenler

Tek tek düzeltmek yerine bunları toplu ele almak daha çok sorunu kapatır.

1. **Durum geçişleri dağınık ve koşulsuz.** Yayında olma, SATILDI, süre dolumu ve onay; istemcide, `setListingStatus`, `renewListing`, `saveListingRecord` ve admin kodunda ayrı yorumlanıyor. Sunucuda tek geçiş tablosu ve `where status=...` koşullu yazma gerekir. "Yayında" SQL'i de tek yerde olmalı.
2. **Aynı route'ta state taşınması.** `defaultRemountDeps` bu sınıfı toptan çözer.
3. **REST ve RPC çift yazım.** Eski mobil REST uçları (`conversations*`, `blocks`, `profile`, `images`) mevcut uygulamada kullanılmıyor, kuralları ayrışmış. Yayında eski build yoksa kaldırmak birçok bulguyu birden kapatır.
4. **Hata, boş durum sanılıyor.** Favoriler, ilanlarım, son bakılanlar, bildirimler, engellenenler, hazır mesajlar, mağaza; mobilde tersi: `isError` dolu ekranı hata ekranına çeviriyor. Ortak hata durumu ve `isError && !data`.
5. **`[user]` bağımlılığı.** Tarih nesneleri yüzünden sekmeye her dönüşte yeniden yükleme, mağaza formunda veri kaybı. `user?.id` kullanılmalı.
6. **Doğrulama son adıma kalıyor; Zod hatası ham JSON.** Fiyat, telefon, zorunlu özellik, trim. Şema paylaşılmalı, Türkçe mesaj verilmeli, hatalar normalize edilmeli.
7. **Elle yazılmış katalog verisi.** `nav-data.ts`, `SearchBar`, `NotFound`, `GENERIC_ROOTS` veritabanından kopmuş.
8. **Oturum sonu temizliği yok (mobil).** Push kaydı, sorgu önbelleği (`recent`, `deletion`, `forEdit`), taslak ve son aramalar. Tek `endSession` akışı.
9. **Sohbette telafi yok.** SSE olay kimliği yok, yoklama değişiklik getirmiyor, sekmeye dönüşte veri çekilmiyor; "görüntülüyor" ve "okudu" kavramları gevşek.
10. **Native modal katmanı.** Toast modalın arkasında kalıyor, `onDismissed` kuralı her yerde uygulanmamış, klavye Sheet'i itmiyor, iOS'ta modal üstüne push.
11. **Sınırsız girdi ve liste.** Gövde limiti yok, `l.*` ile limitsiz listeler, sayfalama eksik, `attrs` sınırsız.
12. **Sayaçların farklı tanımı.** Push rozeti, sekme sayacı ve gelen kutusu ayrı SQL; mesaj ayrıca bildirim sayılıyor.
13. **Tasarım token'ları.** Açık temada `subtle` (#8a929e) yaklaşık 3,1:1; koyu temada beyaz yazı `primary` üstünde 3,7:1, `urgent` üstünde 2,8:1, `ok` üstünde 2:1; `text-ink`/`bg-ink` koyu temada zeminle birleşiyor; `text-violet-700`, grafik ve çip renkleri sabit.
14. **Erişilebilirlik tekrarları.** İç içe etkileşim (`<a><button>`, kart içinde kalp), el yapımı çekmece ve dialog (rol, Esc, odak yok), bağlı olmayan etiketler, klavyesiz radyo grupları, `<tr onClick>`.
15. **Audit eksik.** Yan etkilerden sonra ve transaction dışında yazılıyor, önce/sonra değeri yok; site üzerinden admin işlemleri hiç yazılmıyor.

---

## 3. Sayfa sayfa ayrıntı

Bölüm 1'de geçen maddeler burada tekrarlanmadı.

### 3.1 Web: vitrin

**Ana sayfa `routes/index.tsx`**
- [ ] O · `index.tsx:317`, `router.tsx:33` — `scrollRestoration` kapalı; 3. sayfadan ilana girip dönünce başa düşülüyor → aç, akış sayfasını sakla.
- [x] D · `catalog.ts:168` — "Yeni ilanlar" başında eski vitrin ilanları çıkabilir → saf `created_at`.
- [x] D · `index.tsx:184,192` — Uzun kök kategori adları `line-clamp-1` ile kesiliyor.
- [ ] D (olası) · `index.tsx:220,353` — `NearbyRail` içeriği itiyor; ekran dışı görsele `priority` veriliyor.
- [x] D · `index.tsx:72,78` — HowTo şemasında "milyonlarca alıcı" iddiası; Google bu zengin sonucu kaldırdı.
- [x] D · `lib/nearby-city.ts:73-76` — Zaman aşımı da "izin verilmedi" görünüyor.

**Arama `routes/search.tsx`**
- [x] O · `search-params.ts:113-114`, `catalog.ts:37-38` — `?sort=foo`, `?page=-1` hata ekranı açıyor → normalize et.
- [x] O · `search.tsx:173-192,590`, `category/$slug.tsx:195-214` — Sayfalama ve çip, uygulanmamış panel değerlerini de URL'ye yazıyor.
- [x] O · `search.tsx:144`, `category/$slug.tsx:150` — `mobile-nav-lock` CSS'i yok, kaydırma kilidi çalışmıyor.
- [x] O · `search.tsx:684-801`, `category/$slug.tsx:332-391` — Çekmecelerde dialog rolü, Esc, odak yok.
- [x] O · `components/listing/Filters.tsx:55-103` — Etiketler bağlı değil, fiyat ve yıl alanları adsız.
- [x] D · `Filters.tsx:53,88-103` — Form değil, Enter çalışmıyor; en az > en çok kontrolü yok.
- [x] D · `Filters.tsx:222-233` — Çoklu seçimde `aria-pressed` yok.
- [x] D · `search.tsx:526-541` — `?page=999` "ilan yok" diyor → son sayfaya yönlendir.
- [ ] D · `search.tsx:369-375`, `catalog.ts:266-270` — Tahmin edilen kategori seçili gibi görünüyor, "Tüm Kategoriler" çalışmıyor.
- [ ] D · `search.tsx:229,371,384` — Kategori değişince gizli filtreler kalıyor.
- [ ] D · `search.tsx:673-676` — Harita linki `city` gönderiyor, `/harita` okumuyor.
- [ ] D · `search.tsx:107`, `category/$slug.tsx:143` — Görünüm tercihi saklanmıyor, varsayılanlar farklı.
- [ ] D · `search.tsx:654` — Yüzen çubuk güvenli alanı hesaba katmıyor.
- [ ] D · `search.tsx:335,625-633` — Arama kutusunda etiket, sayfada `aria-current` yok.
- [ ] D · `search.tsx:542-546`, `doping.tsx:22`, `satici/$id.tsx:148-158` — `<a>` içinde `<button>`.

**Kategori `routes/category/$slug.tsx`**
- [x] O · `:291-326` — Sayfalama `<button>`, `href` yok; SEO ve yeni sekme kaybı → `Link`.
- [x] O · `:72`, `seo.ts` middleware `:134-156` — Yaklaşık 8.000 kategori, ilansızlar da indekste → `total===0` noindex.
- [x] O · `lib/seo.ts:96-100` — "Satılık Daire Konut İlanları" başlığı → yaprak adını kullan.
- [x] O · `lib/seo.ts:47-50,75,115-118,161`, `search.tsx:324` — "İş İlanları İlanları"; `GENERIC_ROOTS` ASCII yazıldığı için eşleşmiyor → slug ile kontrol.
- [x] O · `:274-280,356` — Filtre boşken "Bu kategoride ilan yok"; masaüstünde temizleme ve çip yok.
- [ ] O · `:268`, `CategoryPicker.tsx` — Büyük kategorilerde seçici ilanların önüne geçiyor, `counts` verilmiyor.
- [ ] D · `:386` — "Filtreleri Uygula (N)" mevcut sonucun sayısını gösteriyor.
- [x] D · `:195-214` — `apply` `neighborhood`, `q`, `urgent`, `featured` değerlerini düşürüyor.
- [x] D · `:311` — Aktif sayfa `bg-ink`, koyu temada 1,04:1 → `bg-primary`.
- [x] D · `:239`, `lib/seo.ts:179` — Sayı biçimsiz; "satılık ve kiralık" metni iş ilanlarına uymuyor.
- [ ] D · `:191-193,226` — Ölü kod; breadcrumb `aria-label` yok.
- [x] D (olası) · `CategoryPicker.tsx:68` — `q` alt kategoriye geçince kalıyor → `key={cat.id}`.

**Harita `routes/harita.tsx`**
- [x] O · `:9,25-29,80-85` — "İllere göre" sayıları son 48 ilandan hesaplanıyor → `group by city`.
- [x] D · `:78-88` — Boş durum yok. `:43-50,64-73` — Klavyesiz örtü, pin adı yalnız fiyat. `:86` — Ölü kod.

**Diğer sayfalar**
- [x] O · `routes/arsiv.tsx:18-28` — Herkese açık kalıntı: "zip'i indir" diyor, indirme yok, `KURULUM.md` yok → sil.
- [x] O · `routes/profil.tsx:102`, `ilanlarim.tsx:289-290` — Doping'e yönlendiriyor, sayfa "kapalı" diyor → girişleri gizle.
- [x] O · `routes/sayfa/$slug.tsx:96-124`, `migrations/0013_legal_pages.sql:30-34` — Boş satırsız liste tek paragrafa akıyor; KVKK başvuru şartları okunmuyor.
- [x] O · `sayfa/$slug.tsx:175` — "Son güncelleme: 16 Eylül 2026" sabit; `updated_at` yok.
- [x] D · `sayfa/$slug.tsx:173,204` — Hakkımızda ve İletişim'de de "Yasal belge" ve Adana mahkemeleri notu.
- [x] D · `sayfa/$slug.tsx:119-123`, `Footer.tsx:76` — E-posta tıklanamıyor.
- [ ] D (olası) · `sayfa/$slug.tsx:154,197` — Çapa başlığı üst menü altında kalabilir.
- [ ] D (olası) · `account.ts:392` — `getStore` herkese açık yanıtta `phone` dönüyor (bkz. mağaza formu bulgusu).
- [x] O · `account.ts:342`, `satici/$id.tsx:224` — Yorum sayısı toplam, liste 20.
- [x] D · `satici/$id.tsx:220-240` — `tablist` eksik. D (olası) · `:69,74-83` — `Person` şemasında `aggregateRating`.

**Kök, stil, Navbar, layout**
- [x] O (olası) · `styles.css:103,111` — `html` ve `body` birlikte `overflow-x: hidden`; `sticky` menü yapışmayabilir → `clip`.
- [x] D · `__root.tsx:142-148` — "İçeriğe atla" yok. D · `__root.tsx:57-62`, `harita.tsx:10-17` — OG etiketleri ana sayfadan miras.
- [x] D · `styles.css:127` — Seçim rengi koyu temada okunmuyor. D (olası) · `styles.css:99` — `scroll-behavior: smooth` sayfa geçişini ağırlaştırıyor.
- [x] O · `nav-data.ts:144-177,192-251` — "Dizüstü", "Apple iPhone" kök kategoriye gidiyor; `bilgisayar`, `cep-telefonu` var.
- [ ] O · `nav-data.ts:26-274`, `SearchBar.tsx:129-135` — `sanayi`, `ozel-ders`, `yardimci` menüde yok.
- [x] O · `Navbar.tsx:351`, `MegaMenu.tsx:47,59`, `MobileNavigationDrawer.tsx:224,238` — Menü noindex `/search?category=` adresine gidiyor → `/category/$slug`.
- [x] O · `Navbar.tsx:320-336` — "Tüm Kategoriler" yalnız fareyle açılıyor.
- [x] O · `MobileNavigationDrawer.tsx:40-44,51,54` — Kilit çalışmıyor, dialog adı, Esc, odak yok, kapanış animasyonu engelli.
- [x] O · `SearchBar.tsx:193,253-260,268` — `listbox` içinde `option` yok; silme düğmesi dokunmatikte görünmüyor.
- [x] D · `MobileNavigationDrawer.tsx:139-145`, `login.tsx:25` — "Kayıt Ol" giriş sekmesini açıyor.
- [x] D · `Navbar.tsx:227,244`, `BottomNav.tsx:70,89` — `/login`'e `redirect` verilmiyor.
- [x] D · `Navbar.tsx:184`, `SearchBar.tsx:28` — `initialQuery` yok, `/search?q=x`'te üst kutu boş.
- [x] D (olası) · `SearchBar.tsx:192-194,146,166` — Panel yükseklik sınırsız; çift X.
- [x] D · `SearchBar.tsx:156,283`, `nav-data.ts:276` — "kategori ile ara" ve "Popüler Aramalar" gerçeği yansıtmıyor.
- [x] D · `Navbar.tsx:341,361` — `no-scrollbar` tanımsız, `py-0.2` geçersiz. D · Dosya sonlarında kalıntı yorumlar.
- [ ] D · `BottomNav.tsx:65` — "İlan Ver" yazısı linkin dışında.
- [x] O · `CookieBanner.tsx:16-19` — Tercih hiç okunmuyor, iki düğme aynı; politika tarayıcı kaydını silmeyi öneriyor. D · `:17` — Depolama kapalıysa banner kapanmıyor.
- [x] D · `catalog.ts:510`, `Footer.tsx:38-46` — Footer için IBAN ve banka alanları da herkese dönüyor.
- [x] D · `styles.css:218-220`, `Footer.tsx:81` — Mobilde çift alt boşluk.
- [ ] D · `NotFound.tsx:145-151` — Arama kutusunda etiket yok.
- [x] O · `ListingCard.tsx:99-105,137` — Favori düğmesi `<a>` içinde. D · `ListingCard.tsx:45-47,104` — Girişsiz favoride yalnız hata toast'ı, 36 px alan.
- [x] D · `components/ui/badge.tsx:19` — Koyu temada ACİL rozeti 2,8:1.

**SEO ve katalog sunucusu**
- [x] D · `seo.ts` middleware `:95,116-124,224` — Statik `lastmod` her gün bugün; boş mağaza sitemap'i indekste.
- [x] D · `catalog.ts:88,151,165-168` — Ters bölü ve `attrs` LIKE kaçışı yok, sıralamada `id` eşitlik bozucusu yok.
- [x] D · `catalog.ts:106-113` — Bilinmeyen kategori filtresi yok sayılıyor (bkz. madde 19).

### 3.2 Web: ilan

**İlan detay `routes/ilan/$slug.tsx`**
- [x] Y · `ListingSections.tsx:97`, `catalog.ts:335` — Sahibe "alıcılara Satıldı görünür" deniyor; alıcı 404 alıyor → SOLD'u aç ve noindex yap ya da metni düzelt.
- [x] O · `$slug.tsx:421`, `ListingSections.tsx:100,115` — Süresi dolmuş INACTIVE/SOLD'da sahip çıkmazda; metin "panelden yayına al" diyor.
- [x] O · `$slug.tsx:139-150,724-726` — `msg`, `review` ve açık durumlar başka ilana taşınıyor.
- [x] O · `ListingImageGallery.tsx:258` — Lightbox'ta dialog rolü ve odak yok.
- [x] O · `ListingImageGallery.tsx:337` — `justify-center` + `overflow-x-auto`, soldaki küçük resimlere ulaşılamıyor.
- [x] D · `ListingImageGallery.tsx:123,261` — Çapraz kaydırma fotoğraf değiştiriyor. `:341` — Küçük resim düğmeleri adsız. `:297` — Telefonda tam master indiriliyor.
- [ ] D (olası) · `ListingImageGallery.tsx:52` — `pushState`, `getListing`'i yeniden çalıştırıyor.
- [x] D · `$slug.tsx:372,211-213`, `social.ts:37` — Süresi dolmuş ilanda "Favorile" hata veriyor. `$slug.tsx:175` — Favori listesi iki kez çekiliyor.
- [x] D · `helpers.ts:444` — Telefon sayacı tıklama sayıyor, tekil değil.
- [ ] D (olası) · `ListingSections.tsx:88-92`, `helpers.ts:272` — Red gerekçesi yalnız bildirimde.
- [x] D · `ListingSections.tsx:190` — Birim kayboluyor (aidat "1500"). D · `ListingDetailSkeleton.tsx:17,25` — İskelet farklı, sayfa zıplıyor.

**İlan ver `routes/ilan-ver.tsx`**
- [x] O · `listing-write.ts:20,115-119` — `attrs` değişimi yeniden incelemeye girmiyor; onaylı ilana serbest metin eklenebilir.
- [x] O · `PhotoUploader.tsx:258` — 10 fotoğrafta bırakılan dosyayı tarayıcı açıyor, form kaybolur.
- [x] O · `ilan-ver.tsx:381,416`, `listing-write.ts:14` — 10 hane kabul, sunucu 1 milyar; hata son adımda. Mobilde 13 hane (`M/lib/format.ts:19`).
- [x] O (olası) · `ilan-ver.tsx:262-263`, `listing-write.ts:12-13` — Boşluklu başlık ham Zod JSON'u gösterebilir.
- [x] O · `ilan-ver.tsx:517-589`, `listing-write.ts:98-101` — Zorunlu BOOLEAN ve MULTI denetlenmiyor.
- [x] O · `ilan-ver.tsx:68-70` — `Number("")` temizlenen alanı 0 yapıyor, "0 km" görünür.
- [x] O · `ilan-ver.tsx:194,268`, `listing-write.ts:53-55`, mobil `ilan-ver.tsx:139,264` — Profil telefonu her ilana `phone_override` yazılıyor; numara değişince eski ilanlar eski kalır.
- [x] O · `ilan-ver.tsx:501` — Telefon adım 1'de denetlenmiyor.
- [x] O · `ilan-ver.tsx:300,388` — Metin düzeltmesi ilanı habersiz PENDING'e düşürüyor; yalnız fotoğraf adımı uyarıyor.
- [x] O · `ilan-ver.tsx:181,191` — Hata yakalama ve yarış koruması yok.
- [x] D · `:165-171,349` — "Kategoriler yükleniyor" sonsuza kalabilir. `:182-184,345` — Aynı yaprağı seçmek değerleri siliyor. `PhotoUploader.tsx:85,231` — Döndürme meşgul sayılmıyor.
- [x] D (olası) · `:192,218`, `listing-write.ts:112` — Mağaza kimliği düzenlemede yanlış atanabilir.
- [x] D · `:45,51,62` — Etiketler bağlı değil. `CategoryPicker.tsx:139` — `aria-label` yok. D (olası) · `:99`, `CategoryPicker.tsx:136,254` — Yer tutucu global arama vaat ediyor.
- [ ] D · `lib/data/geo.ts:85-111` — Mahalle verisi 4 ilde örnek.
- [ ] D (olası) · `api/upload.ts:14-17` — Boyut `content-length`'e bağlı. `image-pipeline.server.ts:133-139` — HEIC sınırı çözümden sonra. D · `:165-172` — JPEG iki kez sıkıştırılıyor.

**İlanlarım, favoriler, son bakılanlar**
- [x] O · `ilanlarim.tsx:65-69` — Hata "Yayında ilanınız yok" görünüyor; mükerrer ilana yol açabilir.
- [x] O · `ilanlarim.tsx:264,274`, `$slug.tsx:406,421` — SOLD için iki ekran farklı kural uyguluyor.
- [x] D · `account.ts:199-211` — Sayfalama yok, `l.*`. D · `ilanlarim.tsx:61` — Varsayılan sekme hep "Yayında". D · `:110-118,220` — Sekme ve görsel link erişilebilirliği.
- [x] D · `account.ts:148-156` — Sahibe "onaylandı" bildirimi. D · `account.ts:146-147` — Admin onayı süreyi yenilemiyor.
- [x] O · `social.ts:60`, `favoriler.tsx:53` — Satılan favori açıklamasız kayboluyor; web ve mobil.
- [x] O · `favoriler.tsx:32` — Hata "Henüz favori yok". D · `social.ts:55` — Limit yok, `l.*`.
- [x] O · `son-bakilanlar.tsx:107-110,123` — Rozetli satırlar 404'e gidiyor.
- [x] O · `recently-viewed.ts:29-37` — Reddedilen ve gizlenen ilanın başlığı, fiyatı ve fotoğrafı görünmeye devam ediyor.
- [x] O · `son-bakilanlar.tsx:37` — Hata boş görünüyor. D · `:125` — "şimdi baktınız", "5 Eki 2026 baktınız".

### 3.3 Web: mesajlaşma ve bildirim

**Sohbet listesi `routes/mesajlar.tsx`**
- [x] Y · `:89`, `retention.ts:35-40` — Arşivdeki sohbet yeni mesajda istemcide çıkıyor, 60 sn içinde geri dönüyor; rozet ve e-posta saymıyor.
- [x] O · `:283` — "Okundu işaretle" mesajları okundu yapmıyor. O · `:60,196` — Tek başarısız yenileme listeyi siliyor.
- [ ] D · `:277` — Menü dokunmatik tablette görünmüyor. `:124,169` — Arşiv boşalınca seçili sekme yok. `:31` — `REJECTED` eşlemesi yok. `:168-175` — Eksik sekme yapısı. `:248` — 11 px düşük kontrast. `:284,288`, `$id.tsx:704` — Eksik ifade. `:60` — "Konuşma"/"sohbet" tutarsız.
- [ ] D (olası) · `:76-94` — `known` güncelleyici içinde okunuyor.

**Sohbet `routes/mesajlar/$id.tsx`**
- [x] Y · `:482-485,558-560,379-382,1184-1186` — Devam eden sonuçlar açık sohbete yazılıyor; A'nın mesajı B'de görünür (bkz. madde 16).
- [x] O · `:224-240,482-485` — SSE önce gelirse mesaj çift görünür, sıra karışabilir.
- [x] O · `:229-234` — Listede olmayan `message_update` sona ekleniyor; eski teklif en alta düşer.
- [x] O · `:460-477` — Eski görünümde gönderim hatasında metin kaybolur.
- [x] O · `:560,1186,1199` — Fotoğraf, teklif ve konum `backToLatest` çağırmıyor.
- [x] O · `:315-317` — Sekmeye dönünce veri çekmeden okundu işaretliyor; gönderen "Görüldü" görür.
- [x] O · `:293-299,363` — Yukarıdayken gelen mesaj okundu sayılıyor; yeni mesaj işareti yok.
- [x] O · `:276,363-364,907` — İlk okunmamışa değil en alta açılıyor.
- [x] O · `:507-512,561-563` — Başarısız fotoğraf kayboluyor, açıklama yine gidiyor.
- [x] O · `:427-435` — Aramada debounce yok, her harf istek; hata "Sonuç yok".
- [ ] O (olası) · `:136,445,891-947` — Her tuşta tüm mesajlar yeniden çiziliyor. `:357-366`, `MessageBubble.tsx:123` — Görsel boyutu ayrılmıyor.
- [ ] O · `:1-1566` — Dosya bölünmeli: `useChatThread` (223-250, 252-347, 368-425), `useChatViewport` (186-213), `ChatComposer` (440-451, 496-569, 1013-1168), `ThreadHeader` (614-735), `ThreadSearch` (427-435, 737-778), `ListingStrip` (781-823), `MessageList` (826-966), diyaloglar (1293-1566).
- [x] D · `:1128-1137` — Odakta her seferinde en alta kayıyor. `:1140` — Telefonda Enter gönderiyor. `:1145-1150` — Panoda görsel varsa metin yapıştırılmıyor. `:1072-1079` — Sürükle-bırak yalnız yazı alanında.
- [x] D · `:696-714` — `catch` yok. `:706-718` — Arşivde de "Arşivle" yazıyor. `:252-262,859` — `hasMore` sıfırlanmıyor. `:981` — Satılmış ilanda "hâlâ satılık" hızlı yanıtı. `:1207-1208` — Hazır cevap metnin üstüne yazıyor. `:1239` — Silme uyarısı eksik. `:808-816` — Telefonda ilan şeridi tıklanmıyor.
- [ ] D (olası) · `:1349` — Teklif 10 hane, sunucu 1 milyar. `:830-832` — `role="log"` açılışta onlarca mesaj okutabilir.
- [ ] D · `:1285,1553` — `alt` ve etiket yok. `:727,1427,1461` — "şikâyet" yazımı.

**Bildirimler `routes/bildirimler.tsx`**
- [x] O · `:50` — Hata "Bildirim yok" görünüyor.
- [x] D · `:47` — `catch` yok. `:38-54` — Sayfa canlı değil. `social.ts:161,179` — 50 gösteriliyor, hepsi okundu oluyor. `retention.ts:16-31` — Sohbet silinince zil rozeti kalıyor. `:91-93` — Bağlantı değil düğme. `chat.ts:104` — Başlık hep "Yeni mesaj". `notification-prefs.ts:3` — Metin alıcıyı kapsamıyor.
- [ ] D (olası) · `:101` — Uzun gövde kırılmıyor.

**Sohbet sunucusu ve bileşenleri**
- [x] O · `chat.ts:389-390,450-451,485-494` — Engel varken çevrimiçi ve son görülme açık, `sendTyping` engeli denetlemiyor.
- [x] O · `chat.ts:227-246` — `respondOffer` engel, kapalı hesap, ilan durumu ve `status='pending'` denetlemiyor; satılmış ilanda teklif kabul edilebilir.
- [x] O · `chat.ts:423-439` — `pollThread` yalnız yeni mesaj getiriyor, yorumu aksini söylüyor.
- [x] O · `chat.ts:104,277-282` — "Herkesten sil" bildirimdeki ilk 80 karakteri silmiyor; IBAN kalır.
- [x] O · `chat.ts:328,387` — `other_closed` yasaklı hesabı içermiyor.
- [x] D · `chat.ts:565-567` — Arşivli işaretli sohbet rozete +1 ekliyor. `:545-549` — Yeni mesaj şikayeti kaydedilmiyor ama başarı dönüyor (mobil raporu bunu O sayıyor). `message-digest.ts:37` — Yasaklılar özete dahil. `user-blocks.ts:2` — Yinelenen işlev.
- [x] O · `Navbar.tsx:98-101,106` — Tek olay zincirleme istek üretiyor.
- [ ] D · `lib/chat-stream.ts:20-21,47-53` — Geçersiz kimlikte 403 tüm akışı kesip 5 sn'de bir deniyor. `:61-67` — Gereksiz bağlantı.
- [ ] D (olası) · `api/chat/stream.ts:13` — Oturum yalnız bağlantıda denetleniyor. `api/chat/image.ts:17-37` — HEIF boyut denetimini atlıyor, işleme üyelikten önce.
- [x] O · `api/tiles/$z/$x/$y.ts:34-62` — Kimliksiz, sınırsız OSM vekili; IP engellenirse harita herkes için bozulur.
- [ ] D · `MapThumb.tsx:8-25` — OSM atfı yok.
- [x] O · `LocationPicker.tsx:81-92,131-137` — Seçilen yer adı ters kodlamayla eziliyor; mobilde de aynı (`M/features/chat/LocationPicker.tsx:87-99,118-124`).
- [x] O · `MessageBubble.tsx:170` — "Kabul et" koyu temada 2:1. D · `:220` — Kendi balonu 3,71:1.
- [x] D · `MessageBubble.tsx:237` — Silinmiş mesaj alıntısı. `:267` — Başarısız balonda menü yok. `LocationPicker.tsx:84-110` — Takılı gösterge, yarış. `components/ui/dialog.tsx:73` — İngilizce "Close".
- [ ] D (olası) · `MapThumb.tsx:8` — 256 px taşabilir. `LocationPicker.tsx:179` — 15 px, iOS yakınlaştırır.

### 3.4 Web: hesap ve ayarlar

**Giriş ve şifre**
- [x] O · `login.tsx:41,68-75,134` — Onay yalnız istemcide, kaydedilmiyor; Google kutuyu atlıyor.
- [x] O · `lib/auth/server.ts:78-85` — Doğrulama linkinin sonucu bildirilmiyor, `?error=` okunmuyor.
- [x] O · `lib/auth/server.ts:57` — `session.expiresIn` yok, varsayılan 7 gün; uygulamayı 7 gün açmayan düşer.
- [x] O · `lib/auth/server.ts:68-70` — Sıfırlama postası isteğin içinde; süreden hesap varlığı anlaşılır, SMTP takılırsa bekler.
- [ ] D · `login.tsx:41` — Kayıt e-postanın varlığını açıklıyor. D (olası) · `:43,48`, `sifre-sifirla.tsx:110-111` — Başarı toast'ı tam sayfa geçişte kayboluyor.
- [x] D · `login.tsx:22-30` — Oturumlu kullanıcı yönlendirilmiyor. `:97` — Ad kırpılmıyor. `:84-89` — Seçili durum yok. `:34-37` — Ölü dal, düğme neden kapalı belli değil. `:112` — Şifre göster yok.
- [x] D · `sifre-sifirla.tsx:108-113` — Süresi dolan token'da yeni bağlantı yolu yok.

**Profil ve ayarlar**
- [x] Y · `ayarlar/magaza.tsx:35-50`, `use-current-user.ts:40-50` — Sekmeye dönünce kaydedilmemiş mağaza formu siliniyor → `user?.id`.
- [x] O · `magaza.tsx:41-42`, `account.ts:262,392-412` — Kişisel numara alana dolduruluyor, kaydedilince `stores.phone` olup herkese açık yanıtta dönüyor. O · `magaza.tsx:49-52` — Sonsuz yükleme. D · `:41,28,44,71,86-90` — İl önerisi kafa karıştırıyor, ölü `slug`, `<a><button>`.
- [x] O · `profil.tsx:31-33,47` — `getMe` hatası sonsuz iskelet. O · `api/avatar.ts:39`, `ayarlar/profil.tsx:85`, `AccountShell.tsx:10-11` — `user.image` ve `avatar_url` ayrışıyor.
- [ ] D · `profil.tsx:88,102` — Kontrast; doping satırı.
- [x] D · `ayarlar/index.tsx:45-53,58,66,25-30` — Odak halkası, kontrast, arama Destek ve Çıkış'ı kapsamıyor.
- [x] O · `api/hesap/verilerim.ts:25-51` — KVKK dışa aktarımı eksik: konum, `kind/meta`, sohbet görselleri, şablonlar, kredi, doping, cihazlar. Yorum "her şey" diyor.
- [x] O · `ayarlar/hesap.tsx:47`, `verilerim.ts:21,86` — Sınır aşılınca hata JSON'u dosya olarak iniyor.
- [x] D · `hesap.tsx:29-32`, `guvenlik.tsx:43-46` — `hasPassword` hata durumunda yanlış; şifreli üye takılır. `hesap.tsx:92,98-99` — "Vazgeç" sonrası şifre alanda. `settings.ts:121-125` — Şifre denemesinde sınır yok. `hesap.tsx:101` — `SIL` kabul edilmiyor. `:47-51` — `<a><button>`.
- [x] O · `ayarlar/profil.tsx:67-74,150`, `account.ts:91` — `"a "` ham JSON toast'ı.
- [x] O · `account.ts:101-108`, `migrations/0009_ops.sql:15` — Telefon doğrulamasız benzersiz ayrılıyor; başkası numaranı kilitleyebilir, sınır yok, numara taranabilir.
- [x] O · `helpers.ts:206,238-241`, `satici/$id.tsx:169`, `csp.ts:14` — Kayıttaki serbest `image` herkese açık profile geçiyor; harici görsel ve IP toplama.
- [x] O (olası) · `api/avatar.ts:15-23` — Boyut `content-length`'e bağlı, HEIF'te yok, hız sınırı yok. D (olası) · `api/avatar/$id.ts:22` — Bir yıl `immutable`.
- [x] D · `guvenlik.tsx:99` — "Şifre kurtarma için doğrulanmış e-posta gerekir" yanlış. `:147` — "Son etkinlik: 3 gün". `:15,78`, `account-nav.ts:59` — Ad tutarsız. `:107,118` — Google kullanıcısına form görünüyor. `:47,131-153` — Hata yok. `:135-150` — Tek cihaz kapatılamıyor.
- [x] O · `guvenlik.tsx:81-86`, `auth/server.ts:62` — E-posta değiştirme yok.
- [x] O · `gizlilik.tsx:32-37`, `bildirimler.tsx:33-37` — Sonsuz yükleme. O · `engellenenler.tsx:28-30` — Hata "kimse yok" görünüyor.
- [x] D · `gizlilik.tsx:62-72`, `gorunum.tsx:27-35` — Radyo klavyesiz. `bildirimler.tsx:125-127,109-110` — Bağlantı yok; SMTP kapalıyken anahtar açık. `engellenenler.tsx:41` — "Ali engeli kaldırıldı". `gorunum.tsx:21`, `AccountShell.tsx:72-101` — Ziyaretçiye "Çıkış yap".

**Ortak**
- [x] O · `components/ui/phone-input.tsx:29,61` — `maxLength` 13, `+90...` yapıştırınca kesiliyor.
- [x] D · `verify.server.ts:7` — "Unauthorized". `gates.tsx:37` — `replace` yok, geri tuşu tuzağı. `AccountShell.tsx:153`, `__root.tsx:146` — İç içe `<main>`. `account-nav.ts:81-97`, `AccountShell.tsx:75,148` — Çift istek. `AccountShell.tsx:116`, `UserAccountDropdown.tsx:166` — Çıkış hatası gösterilmiyor. `UserAccountDropdown.tsx:36-73` — Menü deseni eksik; `:109,155,171` terim tutarsız.
- [x] D (olası) · `settings.ts:91`, `DeletionBanner.tsx:27` — `::text` tarih Safari'de "Invalid Date" olabilir; mobil Hermes için de geçerli (`M/app/ayarlar/guvenlik.tsx:51`, O).
- [x] D · `auth/server.ts:35,43-45` — `localhost` üretimde güvenilir. `sign-in-gate.ts:8`, `use-current-user.ts:64` — Ölü kod. `styles.css:22` — `text-subtle` AA altı.

### 3.5 Web: admin operasyon

- [ ] D (olası) · `routes/admin.tsx:11` — `confirmedOnClient` sıfırlanmıyor.

**Kontrol paneli**
- [x] O · `admin/dashboard.ts:89,97,100` — Süresi dolanlar "yayında" sayılıyor, iki farklı sayı.
- [ ] O (olası) · `dashboard.ts:23-25,33-34,68` — `created_at` indeksleri yok, 2 dakikada bir tarama.
- [ ] D · `dashboard.ts:26`, `index.tsx:243` — "Yeni sohbet" `updated_at` ile sayılıyor. `index.tsx:240,247-248` — Haftalık kartta haftalık olmayanlar. `:69`, `moderasyon.tsx:59` — "5 gündır". `:112,121-122` — "0 toplam" yüklenirken. `dashboard.ts:12-35` — Kullanılmayan sorgular.
- [ ] D (olası) · `index.tsx:40,150-156,185` — Grafikte sabit renk.

**İlanlar ve ListingSheet**
- [x] O · `ilanlar.tsx:111` — Seçim filtre değişince kalıyor; görünmeyen ilan toplu silinir.
- [x] O · `listings.ts:338-374` — Sıra güncelle, satır satır `notify`, en son audit; zaman aşımında kayıt kalmaz.
- [x] O · `ListingSheet.tsx:331,347`, `listings.ts:386` — Boş fiyat 0, `1250.5` → `12505`.
- [x] O · `listings.ts:332-335,338-361` — Silme ve Satıldı'da satıcıya bildirim ve gerekçe yok.
- [x] O · `admin/search.ts:19-22` — CSV formül enjeksiyonu (`=HYPERLINK`).
- [x] O · `hooks.tsx:267` — Silme metni şikayet ve doping kayıtlarını söylemiyor.
- [x] D · `hooks.tsx:258-259` — Gün "abc" → 1. `:280` — Her işlemde "İlan güncellendi". `:239`, `listings.ts:348` — Reddet dili çelişkili. `listings.ts:325-330` — Taşımada zorunlu alan yok. `:402` — İl boşaltılamıyor. `:246`, `ilanlar.tsx:262-271` — 200 sınırı. `ListingSheet.tsx:251-298` — İki yakın düğme.

**Moderasyon**
- [x] O · `moderasyon.tsx:134-158` — `R` sonrası `1-7` input'a yazılıyor; fareyle Reddet'te `A` açık, `Esc` kapatmıyor.
- [x] O · `listings.ts:281-292` — İki moderatör çakışır, çelişkili bildirim gider → koşullu güncelle.
- [ ] O (olası) · `moderasyon.tsx:78-79` — Telefonda liste panelin üstünde.
- [ ] D · `:20`, `listings.ts:112-129` — Ağır yenileme. `:155` — Ok sayacı taşıyor. `:214-337` — Etiket eksikleri.

**Kullanıcılar**
- [x] O · `users.ts:237-258,359` — Tek admin kademesi; ek doğrulama yok, eşzamanlı sıfır admin kalabilir.
- [x] O · `helpers.ts:228`, `users.ts:245`, `UserSheet.tsx:280` — Bootstrap e-postası yeniden ADMIN oluyor; arayüz aksini söylüyor.
- [x] O · `UserSheet.tsx:416-425`, `users.ts:316,327` — Not tüm profille kaydediliyor; yeni veriyi ezebilir.
- [x] O · `users.ts:161-163`, `listings.ts:186` — "Hakkında şikayet" ilan sahibine sayılıyor; mağdur riskli görünür.
- [x] O · `users.ts:380`, `UserSheet.tsx:515-521`, `finans.tsx:280` — ±100.000 onaysız kredi, negatif bakiye, kendine yükleme.
- [x] O · `users.ts:336`, `business.ts:96`, `listings.ts:409` — Audit'te önce/sonra yok.
- [ ] O (olası) · `account-purge.ts:23-24`, `business.ts:161-163` — Üye silinince ödeme kayıtları ve geçmiş gelir siliniyor; mali müşavire sorulmalı.
- [ ] D · `users.ts:55`, `business.ts:29`, `listings.ts:184` — "Yayında" süre koşulsuz. `users.ts:406` — `//alan.com` kabul ediliyor. `kullanicilar.tsx:178`, `ilanlar.tsx:376` — `<tr onClick>`. `UserSheet.tsx:252-362` — Silinme iptali yok.

**Şikayetler**
- [x] O · `moderation.ts:62`, `sikayetler.tsx:221` — Görsel şikayetinde moderatör görseli görmüyor.
- [x] O · `moderation.ts:44,109` — Askı rozeti ilan sahibinden hesaplanıyor.
- [x] O · `sikayetler.tsx:85-87,107` — Taşan sayfa "Açık şikayet yok" gösteriyor.
- [x] O · `moderation.ts:46`, `listings.ts:73` — Sayılar mesaj şikayetlerini de içeriyor.
- [x] O · `sikayetler.tsx:31`, `moderation.ts:147` — Seçim kalıyor, kapalı kayıt yeniden kapanıyor; kapatan adı eziliyor.
- [x] D · `sikayetler.tsx:130` — Süresi dolan "Yayında". `moderation.ts:28` — Arama şikayet edileni kapsamıyor. `:147,151` — Eski not kalıyor. `:60-82` — N+1. `sikayetler.tsx:90-104,158` — Tümünü seç ve sonuç bildirimi yok.

**Yorumlar, mağazalar, kayıtlar, ortak**
- [x] O · `yorumlar.tsx:144` — Yorum kesik, açma yok, silme geri alınamaz. D · `:112,58,22` — Seçim tutarsız, `span` etiketi.
- [x] O · `business.ts:124-135` — Kapanışta bildirim yok, kayıt eksik.
- [x] D · `magazalar.tsx:84-94` — Aramada "Henüz mağaza yok". `business.ts:78,107-119` — Adres boşaltma; askıdakine mağaza. D (olası) · `magazalar.tsx:63` — Paketin etkisi yok. `ui.tsx:67,123` — `text-violet-700` koyu temada 2,5:1.
- [x] O · `account.ts:136-148,170-174`, `listing-write.ts:68` — Admin site üzerinden işlem yaparsa audit yazılmıyor.
- [x] D · `content.ts:279` — Eski admin süzülemiyor. `format.ts:127-128` — `user.unban` kırmızı, `listing.deactivate` yeşil. `kayitlar.tsx:70,88-99,33-47` — Klavyesiz; kırık "aç"; filtre yok. `AuditList.tsx:16` — Ölü prop.
- [ ] D · `ui.tsx:235-246` — Debounce eski değeri URL'ye yazıyor. `dashboard.ts:195-207` — `#` ve boşluk normalize edilmiyor, indeks devre dışı. `AdminShell.tsx:153-163` — Mobil menüde odak ve Esc yok. `listings.ts:10`, `moderation.ts:41,124-127` — Ölü kod.
- [ ] D (olası) · `format.ts:139-141` — Ham Zod JSON. `AdminShell.tsx:192-198` — Linux'ta ⌘; "Siteye git" mobilde gizli.

### 3.6 Web: admin yapılandırma

**Ayarlar**
- [x] O · `config.ts:105`, `CookieBanner.tsx:27` — `gs-uid` 1 yıllık kimlik çerezi "Sadece zorunlu" seçene de yazılıyor; metinle çelişiyor (hukukçuya sor).
- [x] O (olası) · `hooks.tsx:22` — Ham Zod JSON; "1.2" sürüm yazınca kayıt düşer.
- [x] D · `ayarlar.tsx:112,91` — IBAN ve iletişim metinleri gerçeği yansıtmıyor. `content.ts:186,202` — IBAN sağlaması yok, audit eksik. `:188` — 0850 kabul edilmiyor. `ayarlar.tsx:20` — Yenileme hatası formu siliyor. `config.ts:50,74` — Hatada kapalı anahtar açık görünür. `flags.ts:110` — Kapalı anahtar adları herkese gidiyor. `ayarlar.tsx:57,215,75` — Durum duyurulmuyor; "Onaysız yayın" onaysız.
- [ ] D (olası) · `config.ts:81` — Kimliksizler aynı `guest` kovasında.

**Özellikler**
- [x] O (olası) · `ozellikler.tsx:255`, `attributes.ts:120` — Kullanımdaki özelliğin türü uyarısız değişiyor.
- [x] D · `attributes.ts:65` — Kullanım sayısı ada göre, kategoriler karışıyor. `ozellikler.tsx:292` — Hata "bağlı değil" görünüyor.

**Güncellemeler (OTA)**
- [ ] O · `mobile-app/app.json`, `W/lib/server/ota.ts` — Kod imzası yok; sızan token tüm telefonlarda kod çalıştırır (mağaza sürümü gerekir).
- [x] O · `guncellemeler.tsx:167` — "Herkese aç (%100)" onaysız.
- [x] O · `migrations/0031_ota_updates.sql:6` — `ota_assets` birikiyor, temizleme yok.
- [x] D · `guncellemeler.tsx:21` — "Yayında" platformu yok sayıyor. `admin/ota.ts:104` — Yeniden yayın `critical` kopyalıyor. `guncellemeler.tsx:42` — Geçersiz yüzde sessiz. `api/ota/publish/update.ts:49` — Yayın audit'te yok.
- [ ] D (olası) · `api/ota/manifest.ts:18` — Her açılışta 30 tam satır. `assets/$hash.ts:41` — `gzipSync` event loop'u kilitleyebilir.

**Kategoriler**
- [x] O · `CategoryPanel.tsx:506`, `CategoryPickerDialog.tsx:133` — Toplu aktarım onaysız; çift tıklama binlerce ilanı taşır.
- [x] O · `categories.ts:339` — "İlan sayısına göre" yalnız doğrudan ilanları sayıyor.
- [ ] O · `kategoriler.tsx:212`, `CategoryPanel.tsx:134` — Sekme veya kategori değişimi düzenlemeyi uyarısız siler.
- [x] D · `categories.ts:274` — Kardeşte aynı ad. `CategoryPanel.tsx:298` — 500 üstü sessiz atılıyor. `CategoryTree.tsx:326,595` — Erişilebilirlik; arama vurgusu koyu temada. `CategoryPickerDialog.tsx:96` — Sonsuz yükleme. `categories.ts:344` — Ölü kod.
- [ ] D (olası) · `CategoryPanel.tsx:135` — Eski adla form. `categories.ts:301` — Eşzamanlı taşımada döngü. `CategoryTree.tsx:360,374,331` — Çok satır, odak, ok tuşları. `categories.ts:274` — Slug değişiminde 301 yok.

**Sayfalar, duyurular, finans, sistem**
- [x] O · `sayfalar.tsx:171`, `content.ts:37` — Altbilgiye bağlı sayfa adresi değişebiliyor; üyelik formu linkleri 404 olur.
- [x] O · `sayfalar.tsx:60` — Başka sayfa seçmek metni uyarısız siler.
- [x] O · `content.ts:42,52` — Yasal metin geçmişi yok.
- [ ] D · `sayfalar.tsx:186,173` — Önizleme canlıdan farklı; boşluk `dirty` bırakıyor.
- [x] O · `content.ts:115`, `duyurular.tsx:100` — Duyuru `notify_prefs`'e bakmıyor, ekran "kapatabilirler" diyor (ticari ileti için hukukçuya sor).
- [x] O (olası) · `content.ts:128` — Push'lar istek içinde sıralı; zaman aşımında yeniden gönderim, üyelere ikinci bildirim.
- [x] D · `content.ts:137,115` — Sayı şişiyor, ölü token silinmiyor, rozet güncellenmiyor. `duyurular.tsx:48,162` — Push kutusu açık kalıyor; hata boş görünüyor.
- [ ] D · `finans.tsx:184,187,138,310` — Kontrast, etiket, boş durumlar. `business.ts:217` — Kayıtta tutar yok. D (olası) · `finans.tsx:157` — Kısaltılmış no aranamıyor.
- [x] O · `content.ts:384`, `message-digest.ts:31` — SMTP yokken "gönderildi" diyor; görevler sayı dönmüyor.
- [x] D · `content.ts:352,356` — Cron yalnız secret varlığına bakıyor; OTA ve `ota_assets` görünmüyor. `sistem.tsx:46,50` — Danger yok; tek hata sayfayı siliyor. D (olası) · `content.ts:310` — Dakikada 16 `count(*)`.

### 3.7 Web: mobil API ve sunucu

- [x] O (olası) · `api/mobile/rpc/$fn.ts:118` — `request.text()` oturumdan önce ve sınırsız; bellek tüketimi.
- [x] D · `account.ts:103`, `api/mobile/profile.ts:129` — Telefon taraması mümkün.
- [x] D · `chat.ts:243` — `respondOffer` koşulsuz (bkz. 3.3).
- [x] O (olası) · `api/mobile/oauth/done.ts:11-17` — `/start` doğrulanmadan kod üretiliyor; `geldesat://` şemasını kaydeden kötü niyetli Android uygulaması tarayıcı oturumundan token alabilir → challenge'ı çereze bağla, App Links.
- [~] D · `oauth/done.ts:17` — Uygulama tarayıcıyla aynı token. `oauth/exchange.ts:22` — `no-store` yok.
- [x] O · `conversations.ts:77`, `conversations/$id.ts:68` — REST her mesajda `notify`, dakikada 40 push.
- [x] O · `conversations.ts:20-32` — Limit yok, üç alt sorgu.
- [x] D · `conversations/$id.ts:40` — `kind/meta` yok. `mobile-conversation-store.ts:38` — Transaction yok.
- [x] D · `api/mobile/listings.ts:11-12` — `limit=abc` 500.
- [x] O · `api/mobile/listings/$id.ts:27` — Eski slug ve `legacy_slug` çözülmüyor; web'de açılan link uygulamada "yayında değil" (mobil raporu Y).
- [x] O · `listings/$id.ts:58` — `phone_reveals(listing_id)` indeksi yok, her detayda tarama.
- [x] O · `listings/$id.ts:95`, `helpers.ts` — Günlük tavan yok; günde yaklaşık 43 bin telefon toplanabilir.
- [x] D · `listings/$id.ts:27` — `listing_no::text` indeks kullanamıyor. `:74` — `has_phone` yok, "Ara" düğmesi hata veriyor (mobil O: `M/app/ilan/[id].tsx:351`).
- [x] D · `my-listings.ts:16-21` — Limit yok. `listing-write.ts:124-156` — Transaction yok. `my-listings/$id.ts:12` — Kullanılmayan GET.
- [x] O · `listing-write.ts:15-20` — `city`, `district`, `attrs` boyut sınırı yok.
- [x] O · `api/mobile/images.ts:27-32` — Eski uç filigran ve EXIF/GPS temizliğini atlıyor; fotoğraftaki konum açığa çıkabilir → 410 veya hattan geçir.
- [x] O (olası) · `image-pipeline.server.ts:229` — `resizeVariant` piksel sınırı yok. D (olası) · `images.ts:18` — `formData()` boyuttan önce.
- [~] D · `image-serve.server.ts:42-43` — Silinen görsel önbellekten sunuluyor, bir yıl `immutable` (KVKK notu).
- [~] D · `profile.ts:18-19`, `account.ts:255-256` — `city` sınırı yok. `profile.ts:135-138`, `account.ts:109-113` — Gönderilmeyen alan NULL. `:101,127` — 400 yerine 500.
- [x] O · `api/mobile/stores/$slug.ts:12` — Askıdaki mağaza mobilde görünüyor, web gizliyor.
- [x] O · `api/mobile/reviews.ts:34-35`, `social.ts:121-130` — Sil-ekle transaction dışında, hata eski puanı kaybettiriyor.
- [x] D (olası) · `reports.ts:30-31` — Çift rapor. D · `favorites.ts:15-22` — Limit yok. `notifications.ts:50` — Tanınmayan `action` hepsini okundu yapıyor. `blocks.ts:13` — Bozuk JSON 500.
- [x] D · `docker-compose.yml:28-44`, `env.ornek` — `CRON_SECRET` yok, süpürme yalnız trafikle çalışır.
- [x] O · `api/geo.ts:71` — 900 ms bekleme önbellekten önce ve kuyruk değil; Nominatim sınırı aşılır, IP engellenebilir.
- [x] D · `geo.ts:92-93` — Yorum 100 m, gerçek 11 m. `:87-88` — Parametresiz 0,0 sorgusu.
- [x] O · `lib/db.ts:113`, `auth/server.ts:52` — `connectionTimeout` ve `statement_timeout` yok.
- [x] O · `helpers.ts` `notify` — Mesaj yanıtı Expo'yu 2,5 sn'ye kadar bekliyor; push arka plana alınmalı.
- [x] O · `helpers.ts` rozet — Gizli ve arşivli sohbetleri sayıyor; silinen sohbetin rozeti düşmüyor.
- [~] D · `helpers.ts` `rateLimit` — 429 yerine 500/400. D (olası) · `errors.ts:13-20` — `code`suz iç hata istemciye gidiyor.
- [x] D · `helpers.ts mapListing`, `account.ts:69`, `listings/$id.ts:79,81` — `String(Date)` dönüyor → `asIso`.
- [x] D · `migrations/0002,0020,0026,0028` — `messages` üzerinde beş örtüşen indeks.
- [~] O · `web/package.json` — RPC, OAuth, durum geçişi, `searchListings`, `leaveReview` testi yok.

### 3.8 Mobil: keşif

- [ ] D · `(tabs)/_layout.tsx:76` — Sekme dokunuşu başa kaydırmıyor.
- [ ] O (olası) · `(tabs)/index.tsx:57`, `sonuclar.tsx:63` — Tekrar eden ilan elenmiyor, anahtar çakışır.
- [ ] D · `index.tsx:128,144,254,136` — Boş şehir durumu; kart "şehir seç" diyor ama izin istiyor; kategori şeridi; rol eksik.
- [ ] O (olası) · `(tabs)/ara.tsx:22` — İkinci dokunuşta klavye açılmaz. O · `ara.tsx:34` — 7-15 haneli her sayı ilan sanılıyor.
- [ ] D · `ara.tsx:117` — Kategori hatası yok. O (olası) · `ara.tsx:97` — Silme VoiceOver'da ulaşılamayabilir.
- [ ] O · `sonuclar.tsx:171` — Kategori kaldırılınca Yıl/KM/m² görünmez filtre olarak kalıyor. O · `:193`, `index.tsx:193` — Sonraki sayfa hatası sessiz.
- [ ] D · `sonuclar.tsx:74,106,123`, `features/search/filters.ts:25` — Başlık ve metin eski; korumasız `back()`; sıralama adı farklı.
- [ ] O · `kategoriler.tsx:22` — Yüklenirken eski liste duruyor, ikinci dokunuş yolu bozuyor. D · `:40` — Android geri tuşu ekrandan çıkıyor.
- [ ] Y · `app/ilan/[id].tsx:77`, `features/listing/favorites.ts:34,42`, `ListingSheets.tsx:187` — Slug veya numarayla açılan ilanda kalp ve sayaç değişmiyor; ikinci dokunuş sessizce favoriden çıkarıyor.
- [ ] O · `app/giris.tsx:35` — Girişte yalnız `me` yenileniyor; `isOwner`, `isFavorite` anonim kalıyor.
- [ ] O · `ilan/[id].tsx:100,105,466` — Çevrimdışı dönüşte tam ekran hata; korumasız geri, derin bağlantıda ölü ekran.
- [ ] O · `ListingSheets.tsx:68` — Her teklif önce "Merhaba..." mesajı gönderiyor; hata ve yeniden denemede çoğalıyor.
- [ ] O · `ilan/[id].tsx:343` — Favori kalbi fotoğraf üstünde zor seçiliyor, dolu değil.
- [ ] O (olası) · `_layout.tsx:46` — Durum çubuğu koyu fotoğrafta okunmuyor.
- [ ] O · `lib/format.ts:102` — "2025'den beri üye".
- [ ] D · `ilan/[id].tsx:147,308,188,242` — Çift link (olası); "bildir/şikayet"; web'deki sahip paneli, fiyat geçmişi, "Tümünü gör" eksik; BOOLEAN ham (olası).
- [ ] O · `satici/[id].tsx:109` — 20 yorumun 5'i, "tümü" yok. D · `:40`, `magaza/[slug].tsx:28` — 404'te "Yüklenemedi". D · `ListingSheets.tsx:187` — `keys.seller` yenilenmiyor.
- [ ] O · `favorites.ts:30,47-50` — Liste yüklenmeden dokununca kalp ters dönebilir. O (olası) · `favoriler.tsx:51` — "Fiyat düşünce haberdar olursunuz" diyor, böyle bildirim bulunamadı. O · `favoriler.tsx:37` — Dolu liste hata ekranına dönüyor. D · `ListingGrid.tsx:61` — Kendi ilanında kalp.
- [ ] O · `api/queries.ts:108` — `keys.recent`, `deletion`, `forEdit` çıkışta silinmiyor.
- [ ] O · `son-bakilanlar.tsx:84,60` — Yayında olmayan satır 404; hata listeyi eziyor. D · `:116` — "12 Eki 2026 baktınız". O (olası) · `:120` — Kaldır düğmesi VoiceOver.
- [ ] O (olası) · `ListingCard.tsx:70` — Kalp iç içe. O · `CategoryPicker.tsx:70,30` — Hata yok, `post` dalı ölü. O · `features/catalog/categoryIcon.ts:18` — Koyu temada 2,3:1.
- [ ] D · `lib/links.ts:44` — `/search` parametreleri, `/son-bakilanlar`, `/ayarlar/*` eşlenmemiş. D (olası) · `:16` — Bozuk `%` hata fırlatıyor; `nearby.ts:10` — "Istanbul" eşleşmiyor; `mapHtml.ts:18` — Leaflet unpkg'den, hata yok.
- [ ] D · `FilterSheet.tsx:48` — En az > en çok. `OptionPicker.tsx:24,56` — Arama metni kalıyor. `ListingGrid.tsx:47` — Ölü prop, iPhone alt boşluğu.
- [ ] O · `ListingGrid.tsx:55`, `ListingCard` — `memo` etkisiz; `sonuclar`'da her tuş tüm kartları çiziyor.

### 3.9 Mobil: ilan verme

- [ ] O · `ilan-ver.tsx:146-150` — Diyalog açıkken kayıt zamanlayıcısı taslağın üzerine boş yazıyor.
- [ ] O · `lib/storage.ts:72`, `auth/auth.ts:169` — Taslak hesaba bağlı değil, çıkışta silinmiyor; ikinci kişi öncekinin başlık ve telefonunu görür.
- [ ] O · `ilan-ver.tsx:69-80` — `attrsQuery` hatasında "Özellikler" adımı atlanıyor. O · `:507,542-576` — Kategori adımı hatası yok.
- [ ] O · `ilan-ver.tsx:214-241` — Android geri tuşu onaysız kapatıyor; düzenlemeler kayboluyor.
- [ ] O (olası) · `lib/photos.ts:37` — `getPendingResultAsync` yok; düşük bellekte çekilen fotoğraf kaybolur. O (olası) · `ilan-ver.tsx:255`, `api/client.ts:50` — İdempotency yok, mükerrer ilan.
- [ ] O · `ilan-ver.tsx:273-275` — INACTIVE düzenlemede "onaya gönderildi" diyor. O · `draft.ts:80-86`, `ilan-ver.tsx:625` — Telefon yoksa hata Yayınla'da.
- [ ] D · `:267` (olası) — `me` yoksa ilan mağazadan kopuyor. `:124,523,318` — Yarım kategori; kırıntı; özellikler siliniyor. `format.ts:19` — 13 hane. `:435` (olası) — Klavye düğmeyi örtüyor. `:603,628` — Düzenlemede "Yayınla". `:375` — Ölü gösterge.
- [ ] Y (olası) · `features/post/PhotoStep.tsx:57-77,124-125` — Ortadaki fotoğrafta Sil düğmesi kırpılıyor; 430 pt altı (375 pt'de 11 pt görünür).
- [ ] O · `PhotoStep.tsx:49-55`, `ilan-ver.tsx:170` — `PhotoItem.error` gösterilmiyor.
- [ ] O · `ilan-ver.tsx:184-195` — Silinen fotoğrafın yüklemesi iptal edilmiyor, günlük 60 sınırına sayılıyor.
- [ ] D · `:123` — `uploading`/`error` fotoğraflar atılıyor. D (olası) · `PhotoStep.tsx:38` — `localUri` öncelikli, boş kare. O · `lib/photos.ts:11-30` — iOS'ta galeri izni gereksiz; reddeden seçiciye ulaşamıyor.
- [ ] D · `ilan-ver.tsx:174-177`, `PhotoReview.tsx:98-103` — `try/catch` yok. D (olası) · `PhotoReview.tsx:86` — Toast modalın altında. `PhotoStep.tsx:50,125` — Sabit renk, rol, 26 pt, Sil onaysız.
- [ ] O · `AttrField.tsx:100-104` — Yıl aralığı yok; web 1950-gelecek yıl, sunucu denetlemiyor. D · `ui/Input.tsx:44-61` — Etiket bağlı değil.
- [ ] O · `ilanlarim.tsx:170-172` — "Satıldı" onaysız, geri alma yok. O (olası) · `:198,221` — "İşlemler" VoiceOver'da ulaşılamayabilir.
- [ ] D · `:54-56` — Önbellek geçersiz kılınmıyor. `:215-219` — Web'deki bitiş tarihi ve "Yenile" eksik. D (olası) · `api/mobile/my-listings.ts:16-20` — Sayfalama yok.
- [ ] O · `ayarlar/sablonlar.tsx:26-31,53-56` — Hata yutuluyor, metin siliniyor. D · `:67` — Art arda silmede silinen geri gelebilir.
- OTA uyumu: bu akışta OTA ile gönderilemeyecek bir ekleme yok; `app.json` ve `package.json` diff'i yalnız satır sonu.

### 3.10 Mobil: mesajlaşma ve bildirim

**Akış ve okundu**
- [ ] O · `features/chat/stream.ts:40,129-133` — Başka sohbet açıkken kaçanlar telafi edilmiyor.
- [ ] O (olası) · `stream.ts:105-118`, `api/chat/stream.ts:65-72` — Heartbeat izleyici yok; ölü bağlantı push'u bastırır.
- [ ] O · `chat.ts:436-439`, `mesaj/[id].tsx:187-194` — Arka plandaki teklif ve silme güncellenmiyor.
- [ ] O (olası) · `mesaj/[id].tsx:166-168,222` — Eski teklif güncellemesi `loadOlder` imlecini bozuyor; aradaki mesajlar yüklenmez.
- [ ] O · `_layout.tsx:81-83`, `mesaj/[id].tsx:151-152` — Tek mesaj üç geçersiz kılma. O · `:104,144,192` — Presence yenilenmiyor.

**Gönderim**
- [ ] O · `mesaj/[id].tsx:234-253` — İyimser gönderim ve yeniden deneme yok; hata anında yeni metin siliniyor.
- [ ] O (olası) · `chat.ts:86-106`, `api/client.ts:46` — İdempotency yok, çift mesaj.
- [ ] O · `:239,574` — Hazır yanıt çipi taslağı siliyor. O · `:276,286-293` — Fotoğraf hatasında seçim ve altyazı kayboluyor. O · `:273,615` — Yükleme göstergesi yetersiz.

**Liste**
- [ ] O · `:210,213` — Gün ayrımı UTC; 00:00-02:59 mesajları önceki günde.
- [ ] O · `:325,437` — `onScrollToIndexFailed` boş, alıntıya gidilmiyor. O · `:327-331,527` — Arama hedefine kaydırma yok.
- [ ] O · `:168,243` — Eski bölümde yeni mesaj boşlukla ekleniyor; yukarıdayken kendi mesajına kaydırma yok.
- [ ] O (olası) · `:427-438` — `maintainVisibleContentPosition` yok. O · `:137-145` — `firstUnreadId` kullanılmıyor.
- [ ] O · `:97,363,456-500`, `Bubble.tsx:36` — Her tuşta görünür satırlar yeniden işleniyor.

**Hata, engel, gezinme, balon**
- [ ] O · `mesaj/[id].tsx:349`, `(tabs)/mesajlar.tsx:134`, `bildirimler.tsx:59` — Yenileme hatası dolu ekranı siliyor.
- [ ] D · `:787,370` — Koşulsuz `back()`. `:87` — `authHeaders` bir kez; girişten sonra 401. `:692-698,470` — Engelde "Yanıtla". `:919,931-936` — Arama hatası yok. `:342-357` — Geri düğmesi yok.
- [ ] D (olası) · `:560,963,974` — Klavye boşluğu, düğme çakışması.
- [ ] O · `:472-479,691-733`, `SwipeToReply.tsx:22` — "Mesaj bilgisi" yalnız kaydırmayla. O · `Bubble.tsx:153-155` — Balonda rol ve eylem yok.
- [ ] O · `Bubble.tsx:99` — Kendi teklif kartında sonuç metni kontrastı 1,02-1,94.
- [ ] D · `Bubble.tsx:57,76,174` — Ölü dal; `::ilan-foto::` ham metin (olası). Sabit renkler: `mesaj/[id].tsx:615,972`, `Bubble.tsx:53-170`, `(tabs)/mesajlar.tsx:233,303,317`, `LocationPicker.tsx:228`, `MapThumb.tsx:22`.

**Mesajlar sekmesi, bildirimler, push**
- [ ] Y (olası) · `(tabs)/mesajlar.tsx:78-88,163` — "Sohbeti sil" sheet kapanırken onay açıyor; `Sheet.tsx:24-28` bunun dondurduğunu yazıyor.
- [ ] O · `_layout.tsx:80-88`, `api/queries.ts:17` — Ön plana dönünce liste ve rozetler 60 sn eski kalıyor.
- [ ] O (olası) · `(tabs)/mesajlar.tsx:140`, `bildirimler.tsx:65` — Arka plan yenilemede spinner.
- [ ] O · `(tabs)/mesajlar.tsx:216-233` — Koyu temada kaydırma eylemleri 2,31-2,79. O · `:199-252` — Eylemlerin ekran okuyucu yolu yok.
- [ ] O · `chat.ts:565-567` — Rozet arşivdekini sayıyor.
- [ ] D · `(tabs)/mesajlar.tsx:137,146-147,292` — `keyboardShouldPersistTaps`; filtre boş metni; durum adı. `chat.ts:96-97,313` — Arşivde sayaç yok; 300 sohbet sınırı.
- [ ] O (olası) · `bildirimler.tsx:44`, `_layout.tsx:97` — Aynı sohbet yığına iki kez eklenebilir. D · `bildirimler.tsx:34-40,74-77` — 50 gösterip hepsini okundu yapıyor; rol yok.
- [ ] O · `_layout.tsx:123`, `helpers.ts:291-296`, `chat.ts:104` — Tek mesaj ikonda 2 yazıyor. O · `helpers.ts:291-296`, `chat.ts:558-571` — Push rozeti arşivliyi sayıyor.
- [ ] O · `_layout.tsx:72-78`, `ayarlar/bildirimler.tsx:26-28,80-85` — İzin ayarlardan verilince token kaydedilmiyor.
- [ ] D · `lib/push.ts:35`, `_layout.tsx:78` — İzin bağlamsız isteniyor; iOS'ta ikinci şans yok.
- [ ] O · `ui/Toast.tsx:21`, `LocationPicker.tsx:58,66,137`, `mesaj/[id].tsx:857,898` — Toast modalın arkasında; hatalar görünmüyor.
- [ ] O (olası) · `LocationPicker.tsx:148,219-263` — Alan klavye altında. `mapHtml.ts:18,26` — CDN hatasında boş harita.
- [ ] D (olası) · `tiles.ts:9`, `LocationPicker.tsx:61`, `MapThumb.tsx:12,22` — Atıf WebView'da açılıyor; konum zaman aşımı yok; koyu tema.

### 3.11 Mobil: hesap ve temel

- [ ] D · `_layout.tsx:78` — Bildirim izni bağlamsız. O · `package.json:5` — Hata raporlama yok; `--rollout 10` çökme oranını göremez.
- [ ] Y (olası) · `app/giris.tsx:222,226` — iOS'ta modal üstünden yasal sayfa modalın altına açılıyor; metin okunamadan üye olunur.
- [ ] O · `giris.tsx:219` — Üyelik onayı örtük; Google ile ilk gelen metin görmeden hesap açar. O (olası) · `:85` — Android'de kapatma durum çubuğu altında. O · `:229` — "Aydınlatma Metni'ni kabul" hukuken sorunlu.
- [ ] D · `giris.tsx:21,101` — `reason` dışarıdan metin yazdırabilir (olası); yanlış modda görünüyor. `:111-114,184,190` — Eski hata kalıyor. `:54` — Doğrulama postası söylenmiyor.
- [ ] O (olası) · `app/oauth.tsx:8`, `giris.tsx:33-37` — Android'de Google sonrası yanlış ekran; cihazda denenmeli. D (olası) · `auth.ts:134` — Askı nedeni görünmüyor.
- [ ] O · `(tabs)/hesap.tsx:41`, `ayarlar/index.tsx:169` — "Üye ol" giriş sekmesini açıyor. D · `hesap.tsx:144,109` — Doping satırı; rol.
- [ ] O · `ayarlar/index.tsx:96-105`, `auth.ts:169-184` — Kötü ağda "Çıkış yap" takılıyor, hesap açık kalıyor → önce yerel temizlik. D · `:80`, `magaza.tsx:54` — `mailto` hatası; `:126` — Rol yok.
- [ ] Y (olası) · `ayarlar/profil.tsx:60-61` — Sheet kapanırken kamera açılıyor; `Sheet.tsx` yorumu dondurduğunu yazıyor → `onDismissed`.
- [ ] O · `profil.tsx:88` — Sonsuz yükleme. D · `:61,42` — `try` dışı; kaydedilmemiş uyarısı yok.
- [ ] O (olası) · `guvenlik.tsx:163` — "Şifre hatalı" toast'ı modal altında. O · `:172` — Silme metni saklananları söylemiyor. O · `:72-88,106` — `hasPassword` ve doğrulama durumu yok. O · `:44` — Açık oturumlar ve diğer cihazlardan çıkış yok.
- [ ] D · `:28` — Şifre tekrar alanı yok. `:56-68` — Geri alma sonrası yenileme yok.
- [ ] O · `gizlilik.tsx:47-53` — Seçili durum duyurulmuyor. D · `Bits.tsx:214`, `gizlilik.tsx:52,61` — Gereksiz ok; "Kimse" iken WhatsApp açık.
- [ ] O · `ayarlar/bildirimler.tsx:32-33,47-51` (olası) — Hızlı kayıtlar tercih kaybettiriyor. O · `Bits.tsx:207` — `Switch` etiketsiz. D · `:114-116,84` — İyimser yok; reddedince ayarlar açılıyor.
- [ ] D · `engellenenler.tsx:45` — Küçük hedef, ad yok. O · `magaza.tsx:37,46` — `me` hatasında sahibe "Başvur" görünüyor. D (olası) · `:76` — `store.plan` ham.
- [ ] O · `auth.ts:23,89` — Giriş ve şifre isteklerinde zaman aşımı yok, düğme sonsuz dönebilir.
- [ ] D (olası) · `auth.ts:158-161` — Bakım sayfası oturumu siliyor. `:101-102` — Bellekte oturumda yeni token atlanıyor. `api/client.ts:69` — Eski istek yeni oturumu kapatabilir.
- [ ] O · `app/ayarlar/` — Ortak oturum koruması yok; misafirde sonsuz yükleme.
- [ ] D · `api/queries.ts:90` — Yapılandırma önbelleği hesaba bağlı değil. D (olası) · `Bits.tsx:20`, `theme.ts:97`, `endpoints.ts:45,114` — Ölü kod.
- [ ] Y (olası) · `ui/Sheet.tsx:105,162-166` — `paddingBottom` mutlak konumda etkisiz; iOS'ta klavye şifre alanını ve onayı örtüyor → cihazda doğrula, `translateY`.
- [ ] O · `ui/Input.tsx:43` — Etiket bağlı değil. O · `ui/Toast.tsx:60` — VoiceOver duyurusu yok. O · `ui/theme.ts:14,44,45,50` — Kontrast (bkz. Bölüm 2).
- [ ] O (olası) · `Button.tsx:23,89`, `Bits.tsx:318` — Sabit yükseklik, büyük yazıda kırpılma. Alt boşluklarda `insets.bottom` yok: `profil.tsx:142`, `guvenlik.tsx:188`, `gizlilik.tsx:90`, `bildirimler.tsx:127`, `engellenenler.tsx:31`, `yasal.tsx:43`.
- [ ] D · `Input.tsx:63`, `Bits.tsx:14,139,318`, `Header.tsx:45`, `Sheet.tsx:107`, `Button.tsx:23` — Rol ve 44 pt eksikleri. `Toast.tsx:32-35` — Yeni toast silinebiliyor.
- [ ] D · `app.json:45-46` — Android filtresi yalnız `/ilan/` (mağaza sürümü gerekir). D (olası) · `app.json:10-15` — OTA imzası yok (bkz. 3.6).
- [ ] D · `scripts/ota-publish.mjs:135-167` — Native değişiklik kontrolü yok; yönergenin en kritik kuralı insan dikkatine bağlı → fingerprint kontrolü.

---

## 4. Önerilen sıra

1. **Hemen, küçük ve etkili:** Madde 1, 2, 4, 5, 6, 8, 9, 16, 17, 22, 24, 31, 37, 39. Çoğu birkaç satır.
2. **Veri ve güven:** 3, 7, 10, 11, 12, 13, 15, 23, 26, 27, 30; eski REST uçlarını kaldırma kararı.
3. **Akışlar:** 18, 19, 20, 21, 25, 28, 29, 32, 38; ortak hata durumu ve `endSession`.
4. **Ürün kararı isteyenler:** Harita (40), arama motoru (41), etkisiz ayarlar (33, 34), SATILDI ilan görünürlüğü, arşive gelen mesaj.
5. **Mağaza sürümü isteyenler:** Apple ile giriş, `associatedDomains` ve Android filtresi, OTA kod imzası (yönerge bölüm 5).
6. **Sonra:** Kontrast token'ları, erişilebilirlik kalıpları, `mesajlar/$id.tsx` bölünmesi, test kapsamı.

**Sıra kuralı:** Web ve mobil birlikte değişen düzeltmelerde web, OTA'dan önce deploy edilmeli. Büyük akış değişiklikleri (mesajlaşma, ilan verme) yönerge gereği özellik anahtarı arkasına alınmalı.
