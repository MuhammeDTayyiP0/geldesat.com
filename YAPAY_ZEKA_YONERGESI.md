# Yapay zekâ yönergesi: özellik, tasarım ve yayın

Bu dosya, GeldeSat'ta kod değiştiren yapay zekâ asistanları içindir. Yeni özellik eklerken, tasarım değiştirirken ya da bir şeyi üyelerin bir kısmına açarken bu kurallara uy. Kullanıcı Türkçe yazar; ona Türkçe cevap ver.

Proje iki parçadan oluşur:

- `web/`: site ve API (TanStack Start + Postgres). Coolify'da çalışır; `master`'a push edilince deploy olur.
- `mobile-app/`: Expo / React Native uygulaması. JavaScript değişiklikleri mağazasız (OTA) gönderilir.

Ayrıntılı insan rehberi: `mobile-app/OTA_GUNCELLEME.md`.

---

## 1. Önce hangi durum olduğuna karar ver

| İstek | Yapılacak | Özellik anahtarı? |
|---|---|---|
| Ufak tasarım değişikliği (renk, yazı, boşluk, ikon, metin) | Kodu doğrudan değiştir | Hayır |
| Yeni özellik ("teklif ver butonu ekle") | Kodu anahtarın arkasına koy | Evet |
| Riskli bir değişiklik (ödeme, ilan verme, mesajlaşma akışı) | Yeni hali anahtarın arkasına koy, eskisini sakla | Evet |
| "Yarısı A'yı, yarısı B'yi görsün" | **Tek** anahtar: açıksa A, kapalıysa B | Evet, tek tane |
| Yeni izin, native kütüphane, ikon, `app.json` native ayarı | Mağaza sürümü gerekir, bkz. bölüm 5 | Evet, `minAppVersion` ile |

Emin değilsen ve değişiklik kullanıcı akışını bozabilecekse anahtar kullan. Anahtar, sorun çıkınca kod göndermeden geri almayı sağlar.

---

## 2. Özellik anahtarı (feature flag) kullanımı

### Kodda

```tsx
// web/ içinde
import { useFlag } from "@/lib/use-flag";

// mobile-app/ içinde
import { useFlag } from "@/lib/flags";

function IlanDetay() {
  const teklif = useFlag("teklif_ver");
  return (
    <>
      {/* ... */}
      {teklif ? <TeklifVerButonu /> : null}
    </>
  );
}
```

Kurallar:

- **Anahtar kapalıyken eski ve güvenli davranış çalışmalı.** Tanımsız ve henüz yüklenmemiş anahtarlar `false` döner, yani yeni kod varsayılan olarak gizlidir.
- **Anahtar adı:** küçük harf, rakam ve `_`, en fazla 60 karakter (`^[a-z0-9_]{1,60}$`). Türkçe karakter kullanma: `teklif_ver` doğru, `teklif_çubuğu` yanlış.
- **Web ve mobilde aynı özellik için aynı adı kullan.** Giriş yapmış bir üye iki tarafta da aynı gruba düşer.
- `useFlag` bir React hook'udur: sadece bileşenin en üst seviyesinde çağır; `if` içinde ya da döngüde çağırma.
- **İki sürüm için tek anahtar kullan.** İki ayrı anahtarı %50 yapmak insanları bağımsız böler: bir kısmı ikisini birden, bir kısmı hiçbirini görür.

  ```tsx
  const yeniKart = useFlag("yeni_ilan_karti");
  return yeniKart ? <IlanKartiA {...props} /> : <IlanKartiB {...props} />;
  ```

- **Üç ya da daha fazla sürüm** şu an desteklenmiyor (anahtar sadece açık/kapalı). Gerekirse kullanıcıya söyle; uydurma bir çözüm yazma.

### Sunucuda (gerekirse)

Anahtarlar arayüz içindir. Bir API'nin davranışı da kişiye göre değişecekse `web/src/lib/server/config.ts` içindeki `resolveFlags({ userId, anonId, platform, appVersion })` fonksiyonunu kullan. Güvenlik ya da yetki kontrolünü asla anahtara bağlama.

### Yüzdeyi yapay zekâ ayarlamaz

Anahtarları ve yüzdeleri kullanıcı **Admin → Ayarlar → Özellik anahtarları** sayfasından yönetir. Kodu yazdıktan sonra kullanıcıya tam olarak şunu söyle:

1. Kod yayınlanınca (web push + mobil `npm run ota`) admin panelinde `<anahtar_adı>` anahtarını ekle.
2. Yeni anahtar "sadece yöneticilere açık" başlar; önce kendi hesabında dene.
3. Sonra yüzdeyi seç (ör. %50) ve kaydet. Sorun çıkarsa ana anahtarı kapat.

A/B durumunda şunu da ekle: "Yöneticilere her zaman açık" ayarı açıkken yönetici hep A'yı görür; B'yi görmek için bu ayarı kapatmalı.

Paneldeki diğer seçenekler:

- **Platform:** Web, iOS, Android. Hiçbiri seçili değilse hepsinde çalışır.
- **En düşük uygulama sürümü:** sadece mobilde geçerli.

### İş bitince anahtarı temizle

Bir özellik %100'de oturduysa ve kullanıcı isterse: `useFlag` kontrolünü ve eski kodu kaldır, yeni kodu kalıcı yap. Ardından kullanıcıya anahtarı admin panelinden silmesini söyle. Önce kodu temizle, sonra anahtarı sil; tersi yeni özelliği herkesten gizler.

---

## 3. Ufak tasarım değişiklikleri

- Mevcut bileşeni doğrudan değiştir; yeni anahtar açma.
- **Mobilde** renkler, boşluklar ve yazı tipleri `mobile-app/src/ui/theme.ts` içindedir; ortak parçalar `mobile-app/src/ui/` altındadır. Sabit renk yazma, tema değişkenlerini kullan (açık ve koyu tema var).
- **Web'de** Tailwind sınıfları ve `web/src/styles.css` içindeki tema değişkenleri kullanılır (`text-primary`, `bg-surface`, `text-muted` gibi). Koyu tema da çalışmalı.
- Web ve mobilde aynı ekran varsa (ilan kartı, ilan detayı vb.) ve kullanıcı aksini söylemediyse iki tarafı uyumlu tut.

---

## 4. Yayınlama

Yayın dışa dönük bir işlemdir. **Kullanıcı açıkça istemeden push etme, OTA yayınlama.**

### Web

- Değişikliği doğrudan `master`'a commit et; ayrı branch açma.
- Push'u sadece kullanıcı isteyince yap. Push = Coolify deploy = canlı site.
- Commit'e sadece kendi değiştirdiğin dosyaları ekle. `mobile-app/.env.local` (yayın anahtarı) asla commit'e girmez.
- Yeni bir sayfa ya da API route'u eklediysen `web/src/routeTree.gen.ts` güncellenmelidir (normalde `vite dev` ya da `vite build` sırasında otomatik olur).

### Mobil (OTA)

`mobile-app/` klasöründe:

```bash
npm run ota -- --message "Ne değişti, kısa Türkçe açıklama"
```

| Seçenek | Ne zaman |
|---|---|
| `--channel preview` | Önce test cihazlarında denemek için |
| `--rollout 10` | Değişikliği cihazların sadece %10'una göndermek için |
| `--critical` | Acil hata düzeltmesi: uygulama indirir indirmez yeniden başlar |
| `--dry-run` | Paketlemeyi yüklemeden denemek için |

- Yayın komutu kullanıcının bilgisayarındaki `GELDESAT_OTA_TOKEN` ile çalışır. Token'ı okuma, yazdırma, değiştirme.
- Geri alma, durdurma ve yüzde değiştirme **Admin → Uygulama güncellemeleri** sayfasından yapılır. Bunları kullanıcıya önerirsin, kendin yapmazsın.
- Web değişikliği (yeni API) ile mobil değişikliği birlikteyse, OTA'dan **önce** web'in deploy edilmiş olması gerekir. Yoksa uygulama olmayan bir API'yi çağırır.

---

## 5. Mağaza sürümü gerektiren değişiklikler (en kritik kural)

OTA sadece JavaScript kodunu ve görselleri değiştirir. Telefondaki uygulamanın native kısmı (kabuk) sadece mağazadan değişir. Şunlar **OTA ile gönderilemez**:

- Native kod içeren yeni bir paket (`npx expo install` ile eklenen ve `package.json`'da henüz olmayan çoğu `expo-*` / `react-native-*` paketi)
- Yeni izin (mikrofon, takvim, kişiler...), `app.json` içindeki `ios`, `android`, `plugins` ayarları
- Uygulama ikonu, adı, açılış ekranı
- Expo SDK yükseltmesi

**Native bir paketi import eden kodu OTA ile göndermek, eski uygulamaları açılışta çökertir.** Bu tür bir değişiklikte:

1. `mobile-app/app.json` → `expo.version` değerini artır (ör. `1.0.0` → `1.1.0`). `runtimeVersion` bu sürümden türer, böylece yeni kod eski build'lere gitmez.
2. Yeni kodu bir anahtarın arkasına koy ve kullanıcıya anahtarın **En düşük uygulama sürümü** alanına yeni sürümü (`1.1.0`) yazmasını söyle.
3. Kullanıcıya yeni mağaza build'i gerektiğini açıkça yaz:

   ```bash
   npx eas-cli@latest build --profile production
   ```

Native değişiklik yoksa `version`'ı **artırma**. Artırırsan yayınlanan OTA'lar mevcut uygulamalara ulaşmaz.

Bir paketin native olup olmadığından emin değilsen kullanıcıya sor ya da Expo dokümanına bak (`mobile-app/AGENTS.md`: Expo sürümüne göre dokümanı oku, ezberden yazma).

---

## 6. Bitirmeden önce kontrol

Tarayıcı açarak ya da geliştirme sunucusu başlatarak kontrol etme. Şunları çalıştır:

```bash
# web/
npx tsc --noEmit
npx eslint <değişen dosyalar>
DATABASE_URL=" " npm test      # yerel veritabanına dokunmamak için boş DATABASE_URL

# mobile-app/
npx tsc --noEmit
npx expo lint
```

Hepsi temizse kullanıcıya Türkçe, kısaca şunları yaz:

- Ne değişti, hangi dosyalarda
- Kullanıcının kendi yapması gerekenler: push onayı, `npm run ota`, admin panelinde anahtar ekleme ve yüzde ayarlama, gerekiyorsa mağaza build'i
- Görsel olarak neyi kontrol etmesi gerektiği (sen tarayıcıda bakmadın)

---

## 7. Hazır tarifler

**"İlan kartındaki fiyatı büyüt."** Anahtar yok. İlan kartını web'de ve mobilde (`mobile-app/src/features/listing/ListingCard.tsx`) değiştir, kontrolleri çalıştır. Kullanıcıya: "Push edeyim mi? Mobil için `npm run ota -- --message "Fiyat büyütüldü"`."

**"Teklif ver butonunu üyelerin yarısına aç."** Butonu `useFlag("teklif_ver")` arkasına koy (web ve mobil). Gerekiyorsa API'yi ekle. Kullanıcıya şu sırayı ver: push → `npm run ota` → admin panelinde `teklif_ver` ekle → kendinde dene → %50.

**"Yarısı yeni ana sayfayı, yarısı eskisini görsün."** Tek anahtar (`yeni_ana_sayfa`): `yeniAnaSayfa ? <Yeni /> : <Eski />`. Eski ekran kodunu silme.

**"İlanlara sesli mesaj ekle."** Mikrofon izni ve native ses kütüphanesi gerekir, yani mağaza sürümü (bölüm 5). `version` artır, özelliği anahtarın arkasına koy, kullanıcıya `minAppVersion` ve yeni build adımlarını söyle.

---

## İlgili dosyalar

| Dosya | İçerik |
|---|---|
| `web/src/lib/flags.ts` | Yüzde ve kural hesaplama (web ve mobil config'i bunu kullanır) |
| `web/src/lib/use-flag.ts` | Web `useFlag` |
| `web/src/lib/server/config.ts` | Anahtarların veritabanından okunması, `resolveFlags` |
| `web/src/routes/api/mobile/config.ts` | Uygulamanın anahtarları aldığı uç nokta |
| `mobile-app/src/lib/flags.ts` | Mobil `useFlag` |
| `mobile-app/src/lib/ota.ts` | Uygulama içi güncelleme kontrolü |
| `mobile-app/scripts/ota-publish.mjs` | `npm run ota` |
| `web/src/lib/server/ota.ts`, `web/src/routes/api/ota/` | Güncelleme sunucusu |
| `web/src/routes/admin/ayarlar.tsx`, `web/src/routes/admin/guncellemeler.tsx` | Admin ekranları |
