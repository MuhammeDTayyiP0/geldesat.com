# GeldeSat Mobil (iOS & Android)

Expo SDK 58 + Expo Router ile yazılmış yerel (native) uygulama. Web sitesiyle aynı veritabanını ve hesapları kullanır; tüm veri `https://www.geldesat.com` API'sinden gelir (`app.json` → `extra.apiBaseUrl`).

## Çalıştırma

```bash
npm install
npx expo start          # geliştirme sunucusu
npm run typecheck       # tsc --noEmit
npm run lint            # expo lint
```

Uygulama Expo Go'da tam çalışmaz (bildirim, konum ve klavye modülleri yerel kod ister). Telefonda denemek için bir geliştirme derlemesi alın:

```bash
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile preview --platform android   # kurulabilir APK
npx eas-cli@latest build --profile production --platform all     # mağaza derlemesi
```

## Klasör yapısı

```
src/app/         ekranlar (Expo Router, dosya = rota)
  (tabs)/        Keşfet · Ara · İlan Ver · Mesajlar · Hesabım
  ilan/[id]      ilan detayı        sonuclar     arama sonuçları + filtreler
  ilan-ver       ilan verme sihirbazı (düzenleme: ?id=)
  mesaj/[id]     sohbet             ayarlar/*    profil, gizlilik, bildirim, güvenlik…
src/api/         tek HTTP istemcisi, uç noktalar, TanStack Query anahtarları, tipler
src/auth/        oturum (SecureStore), e-posta/Google girişi
src/features/    ilan, arama, sohbet, ilan verme, konum bileşenleri
src/ui/          tasarım sistemi (tema, buton, alan, alt panel, başlık…)
src/lib/         biçimlendirme, fotoğraf, push, yerel depolama, link eşleme
src/data/        il/ilçe/mahalle listeleri (web/src/lib/data ile aynı)
```

## Sunucu tarafı (web/)

- **Kimlik:** Better Auth `bearer` eklentisi; uygulama `Authorization: Bearer <token>` gönderir.
- **`/api/mobile/*`:** ilan, favori, profil, bildirim, yükleme gibi REST uçları.
- **`/api/mobile/rpc/<ad>`:** web'deki sunucu fonksiyonlarını (sohbet, ayarlar, katalog…) beyaz listeyle mobile açan köprü. Her fonksiyon kendi doğrulamasını ve yetki kontrolünü çalıştırır.
- **`/api/mobile/oauth/*`:** Google ile giriş (PKCE: uygulamaya yalnızca tek kullanımlık kod döner).
- **`/api/chat/stream`:** canlı mesajlar (SSE); uygulama tek bir paylaşımlı bağlantı kullanır.

## Yayın öncesi

### Test APK (preview profili)

1. Node 22.13+ kurulu olsun (Expo SDK 58 bunu istiyor).
2. `npx eas-cli@latest login` ile `thelouss-team` hesabına girin.
3. `cd mobile-app` ve `npx eas-cli@latest build --profile preview --platform android`
4. İlk derlemede "Generate a new Android Keystore?" sorusuna **Yes** deyin; anahtar EAS'ta saklanır.
5. Derleme bitince verilen bağlantıdan / QR koddan APK'yı telefona indirip kurun (bilinmeyen kaynaklara izin vermek gerekir).

`preview` APK canlı siteye (`www.geldesat.com`) bağlanır. `development` profili için `expo-dev-client` gerekir; EAS ilk derlemede kurmayı önerir.

### App Links / Universal Links

Doğrulama dosyaları `web/server/middleware/app-links.ts` içinden servis edilir (`/.well-known/assetlinks.json`, `/.well-known/apple-app-site-association`, ikisi de `application/json`). Değerler girilene kadar 404 döner:

- `ANDROID_SHA256_FINGERPRINTS`: `npx eas-cli@latest credentials -p android` → SHA-256 (preview/EAS imzası) ve Play Console → Uygulama bütünlüğü → Uygulama imzalama anahtarı SHA-256 (mağaza sürümü).
- `APPLE_TEAM_ID`: Apple Developer → Membership → Team ID.

Web deploy'dan sonra kontrol: `curl -i https://www.geldesat.com/.well-known/assetlinks.json` (200, `application/json`, yönlendirme yok). Coolify proxy'si `geldesat.com` → `www` yönlendirmesi yapıyorsa `/.well-known/` yolunu bundan muaf tutun.

### Diğer

- Google ile giriş için sunucuda `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` tanımlı olmalı; uygulama düğmeyi `/api/mobile/config` yanıtına göre gösterir.
- Sürüm numarası `app.json` → `version`; derleme numaralarını EAS tutar (`appVersionSource: remote`, production'da `autoIncrement`).
- `eas.json`'daki `channel` alanları `expo-updates` kurulunca (OTA güncellemeler) anlam kazanır; şimdilik etkisizdir.
