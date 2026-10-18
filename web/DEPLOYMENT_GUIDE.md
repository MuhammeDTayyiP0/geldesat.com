# GeldeSat 2 - aaPanel Kurulum Kılavuzu

Bu kılavuz, GeldeSat projesini aaPanel yüklü bir sunucuda nasıl yayına alacağınızı adım adım anlatır.

## 1. Ön Hazırlık (aaPanel)

1.  **Node.js Yükleyin:**
    *   aaPanel'de **App Store** > **Node.js version manager**'a gidin.
    *   **Node.js v20** veya üzeri bir sürümü (Stable/LTS) yükleyin.
2.  **Veritabanı:**
    *   Bu proje varsayılan olarak **PostgreSQL** kullanır.
    *   Eğer sunucunuzda PostgreSQL yoksa, ya Docker ile kurun ya da projenizi MySQL'e çevirin (Aşağıda açıklanmıştır).
    *   Veritabanı oluşturun ve bağlantı adresini (Connection String) not edin.
    *   Örnek: `postgresql://kullanici:sifre@localhost:5432/veritabani_adi`

## 2. Dosyaların Yüklenmesi

1.  aaPanel **Files** menüsüne gidin.
2.  `/www/wwwroot/` altında projeniz için bir klasör oluşturun (örn: `geldesat`).
3.  Bilgisayarınızdaki proje dosyalarını **ZIP** yapın (`node_modules` ve `.next` klasörlerini **HARIÇ** tutun).
4.  ZIP dosyasını sunucuya yükleyin ve klasör içine çıkarın (Unzip).

## 3. Yapılandırma (.env)

Proje ana dizininde `.env` isminde bir dosya oluşturun ve aşağıdaki ayarları girin:

```env
# Veritabanı Bağlantısı (Kendi bilgilerinizle değiştirin)
DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/veritabani_adi"

# Güvenlik Anahtarı (Rastgele uzun bir şifre belirleyin)
AUTH_SECRET="buraya-cok-gizli-uzun-ve-karmasik-bir-sifre-yazin"

# Site Adresi (Domaininiz)
NEXTAUTH_URL="https://siteniz.com"

# Google Auth (Opsiyonel - Google ile giriş için)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

*> **Not:** Eğer MySQL kullanacaksanız, `prisma/schema.prisma` dosyasında `provider = "postgresql"` yazan yeri `provider = "mysql"` yapın.*

## 4. Kurulum ve Derleme (Terminal)

aaPanel'de **Terminal**i açın veya SSH ile bağlanıp proje klasörüne gidin:

```bash
cd /www/wwwroot/geldesat
```

Sırasıyla şu komutları çalıştırın:

1.  **Paketleri Yükleyin:** `npm install`
2.  **Veritabanını Eşitleyin:** `npx prisma db push`
3.  **Başlangıç Verilerini Ekleyin (Kategoriler vb.):** `npx prisma db seed`
4.  **Projeyi Derleyin (Build):** `npm run build`

## 5. Projeyi Başlatma (Node Project Manager)

aaPanel'in "Website" özelliğini kullanarak projeyi başlatmak en kolayıdır.

1.  aaPanel **Website** > **Node Project** sekmesine gelin.
2.  **Add Node Project** butonuna tıklayın.
    *   **Project Directory:** `/www/wwwroot/geldesat` (Proje klasörünüz)
    *   **Run Command:** `start` (veya `npm start`)
    *   **Port:** `3000` (Otomatik bulmazsa elle yazın)
    *   **Domain:** Domain adınızı yazın (örn: `geldesat.com`).
3.  **Submit** diyerek projeyi başlatın.

Eğer Node Project Manager kullanmıyorsanız, PM2 ile manuel başlatın:
```bash
npx pm2 start npm --name "geldesat" -- start
```

## 6. Erişim ve Son Kontroller

*   Tarayıcıdan domain adresinize (veya sunucu IP:3000) gidin.
*   Site açılmalıdır.
*   İlk girişte "Giriş Yap" diyerek bir hesap oluşturun. Yönetici yetkisi kayıt sırasına göre verilmez: `ADMIN_EMAILS` ortam değişkenine doğrulanmış (ör. Google ile giriş yapılmış) e-postanızı yazın ya da veritabanında `update profiles set role='ADMIN' where user_id='...';` çalıştırın.

## Sık Karşılaşılan Sorunlar

*   **Resim Yükleme Hatası:** `public/uploads` klasörünün yazma izni olduğundan emin olun. (Sağ tık > Permission > 755 veya 777).
*   **502 Bad Gateway:** Node.js servisi çalışmıyor demektir. Terminalden loglara bakın (`pm2 logs` veya aaPanel logları).
*   **Veritabanı Hatası:** `.env` dosyasındaki şifrede özel karakterler varsa URL encode yapmanız gerekebilir.
*   **MySQL Hatası:** Eğer MySQL kullanıyorsanız `schema.prisma`'yı değiştirdikten sonra `prisma generate` komutunu çalıştırmayı unutmayın.
