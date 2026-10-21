# Mağazasız güncelleme ve özellik anahtarları

GeldeSat'ta iki sistem birlikte çalışır, ikisi de kendi sunucumuzda, ücretsiz ve limitsiz:

| | Ne yapar | Nereden yönetilir |
|---|---|---|
| **OTA güncelleme** | Yeni JavaScript kodunu (ekranlar, tasarım, hata düzeltmeleri) mağaza onayı olmadan telefonlara gönderir. | `npm run ota` komutu + Admin → **Uygulama güncellemeleri** |
| **Özellik anahtarları** | Kodu gönderilmiş bir özelliği kime açacağını seçer: yöneticiler, üyelerin %X'i, platform, en düşük sürüm. | Admin → **Ayarlar → Özellik anahtarları** |

## 1. İlk kurulum (bir kez)

1. **Sunucu anahtarı.** Rastgele bir değer üretin:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
   Coolify'da web servisine `OTA_PUBLISH_TOKEN` ortam değişkeni olarak ekleyip yeniden deploy edin.
2. **Bilgisayar anahtarı.** Aynı değeri `mobile-app/.env.local` dosyasına yazın (git'e girmez):
   ```
   GELDESAT_OTA_TOKEN=...aynı değer...
   ```
3. **Yeni mağaza sürümü.** `expo-updates` uygulamanın içine gömülen bir kütüphane olduğu için OTA, ancak bu kütüphaneyi içeren bir build ile başlar. Bir kere yeni build alıp mağazaya gönderin:
   ```bash
   npx eas-cli@latest build --profile production
   ```
   Bundan sonraki JavaScript değişiklikleri OTA ile gider.

## 2. Güncelleme yayınlamak

`mobile-app` klasöründe:

```bash
npm run ota -- --message "İlan kartı yenilendi"
```

| Seçenek | Ne işe yarar |
|---|---|
| `--channel preview` | Sadece test APK'larına (eas `preview` profili) gönderir. Önce burada deneyin. |
| `--rollout 10` | Cihazların sadece %10'una gönderir. Sorun yoksa panelden %100 yapın. |
| `--critical` | Telefon güncellemeyi indirir indirmez uygulamayı yeniden başlatır (acil hata düzeltmeleri için). |
| `--platform android` | Sadece bir platforma gönderir. |
| `--dry-run` | Paketler ama yüklemez; komutun çalıştığını görmek için. |

Telefonlar uygulamayı açınca yeni kodu arka planda indirir ve **bir sonraki açılışta** kullanır. Uygulamayı hiç kapatmayanlar, uygulamaya 30 dakikadan uzun aradan sonra döndüklerinde de kontrol edilir.

### Bir şey ters giderse (Admin → Uygulama güncellemeleri)

- **Durdur:** Güncelleme henüz almamış cihazlara gitmez.
- **Bu sürüme geri dön:** Eski bir güncellemenin kopyasını en yeni olarak yayınlar. Herkes o koda döner. Telefonlar her zaman ellerindeki en yeni güncellemeyi kullandığı için geri dönüş bu şekilde yapılır.
- **Herkesi mağaza sürümüne döndür:** Tüm OTA güncellemelerini devre dışı bırakır, telefonlar mağazadan yüklenen kodu kullanır. Son çare.

## 3. Özellik anahtarları (feature flag)

Kodda bir özelliği anahtarın arkasına koyun:

```tsx
// Mobil (mobile-app)
import { useFlag } from '@/lib/flags';

// Web (web)
import { useFlag } from '@/lib/use-flag';

const teklif = useFlag('teklif_ver');
return teklif ? <TeklifVerButonu /> : null;
```

Önerilen akış (Instagram ve TikTok'un yaptığı gibi):

1. Kodu yazın, `useFlag('teklif_ver')` arkasına koyun, OTA ile yayınlayın. Anahtar yokken kimse görmez.
2. Admin → Ayarlar → Özellik anahtarları → `teklif_ver` ekleyin. Yeni anahtar **sadece yöneticilere açık** başlar; kendi hesabınızda deneyin.
3. Yüzdeyi %5 → %25 → %50 → %100 yapın. Aynı üye her zaman aynı sonucu alır; yüzdeyi artırınca önceden görenler görmeye devam eder.
4. Sorun çıkarsa ana anahtarı kapatın: herkeste kapanır: açık sayfalarda ve uygulamada birkaç dakika içinde, yeni açılışlarda hemen.

Giriş yapmamış kişiler cihaz kimliğine (web'de bir çereze) göre, giriş yapmış üyeler hesaplarına göre gruplanır. "En düşük uygulama sürümü" doluysa, o sürümden eski uygulamalar özelliği görmez (o kodu içermeyen eski sürümler için).

## 4. Ne zaman yine mağaza güncellemesi gerekir?

OTA yalnızca JavaScript kodunu ve görselleri değiştirebilir. Şunlar için yeni build gerekir:

- Yeni bir native kütüphane eklemek (`npx expo install ...` ile gelen ve native kod içeren paketler)
- Yeni bir izin (kamera, mikrofon vb.), ikon, uygulama adı ya da `app.json`'daki native ayarlar
- Expo SDK yükseltmesi

Bu durumda **`app.json` → `version`'ı artırın** (ör. `1.0.0` → `1.1.0`) ve yeni build alın. `runtimeVersion` sürümden türetildiği için, `1.1.0` için yayınlanan OTA'lar `1.0.0` uygulamalara hiç gitmez; eski koda uymayan bir güncelleme telefonu bozamaz. Native bir değişiklik yoksa sürümü artırmayın, yoksa OTA'lar eski build'lere ulaşmaz.

## 5. Test etme

OTA geliştirme sürümünde (`expo start`, dev client) çalışmaz. Denemek için:

- `npx eas-cli@latest build --profile preview` ile bir test APK'sı alıp `npm run ota -- --channel preview --message "deneme"` yayınlayın, ya da
- `npx expo run:android --variant release` ile yerel release build alın (kanal başlığı olmadığı için `production` kanalını alır).

Ayarlar ekranının en altındaki sürüm satırı, OTA ile gelen bir kodu çalıştırırken güncelleme kimliğini de gösterir (ör. `GeldeSat 1.0.0 · a1b2c3d4`).
