# Coolify ile yayına alma

GeldeSat, Coolify'da tek bir Node konteyneri ve bir Postgres veritabanı olarak
çalışır. Uygulama tek süreçtir: anlık mesajlaşma, hız sınırlama ve önbellekler
süreç belleğinde tutulur, bu yüzden **tek replika** çalıştırın.

## 1. Veritabanı

Coolify'da **New Resource → Database → PostgreSQL 16** oluşturun ve iç
bağlantı adresini (`postgres://...`) kopyalayın.

## 2. Uygulama

1. **New Resource → Application**, bu depoyu seçin.
2. **Base Directory:** `/web` (uygulama artık `web/` klasöründe).
3. **Build Pack:** `Dockerfile` (önerilen) ya da `Nixpacks`. İkisi de
   `npm run build` ile derler ve açılışta migration'ları uygular.
4. **Port:** `3000`.
5. Alan adını (`https://www.geldesat.com`) ekleyin; Coolify HTTPS sertifikasını
   kendisi alır. `geldesat.com` adresine gelenler otomatik olarak `www`'ya
   yönlendirilir.

## 3. Ortam değişkenleri

`.env.example` dosyasındakileri Coolify'da **Environment Variables**'a girin.
En az şunlar gerekli:

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | 1. adımdaki Postgres adresi. Yoksa uygulama başlamaz. |
| `BETTER_AUTH_URL` | `https://www.geldesat.com` (sonunda `/` yok) |
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` çıktısı. Yoksa uygulama başlamaz. |
| `ADMIN_EMAILS` | Yönetici e-postası (doğrulanmış hesap olmalı) |

`VITE_GOOGLE_AUTH_ENABLED` derleme sırasında okunur: Coolify'da **Build
Variable** olarak işaretleyin.

## 4. Yönetici hesabı

Yöneticilik kayıt sırasına göre verilmez. İki yol var:

- `ADMIN_EMAILS` değişkenine e-postanızı yazın ve o adresle **Google ile** giriş
  yapın (ya da SMTP ayarlıysa e-postanızı doğrulayın).
- Ya da veritabanında: `update profiles set role='ADMIN' where user_id='...';`

## 5. Güncelleme

Depoya push sonrası Coolify'da **Redeploy**. Yeni migration dosyaları
konteyner açılırken otomatik uygulanır.

## Sorun giderme

- **Uygulama hemen kapanıyor:** Logda `DATABASE_URL` ya da
  `BETTER_AUTH_SECRET` uyarısı varsa değişkeni ekleyin.
- **Girişten sonra oturum düşüyor:** `BETTER_AUTH_URL` sitenin gerçek HTTPS
  adresi olmalı.
- **Şifre sıfırlama "etkin değil" diyor:** `SMTP_HOST` ve `SMTP_FROM`
  tanımlanmamış.
