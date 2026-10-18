# Google ile Giriş Kurulum Rehberi

Sitenize "Google ile Giriş Yap" özelliğini eklemek için Google'dan bir servis hesabı oluşturmanız gerekir. Aşağıdaki adımları sırasıyla uygulayın.

## 1. Google Cloud Console'a Giriş
1.  [Google Cloud Console](https://console.cloud.google.com/) adresine gidin.
2.  Google hesabınızla giriş yapın.

## 2. Yeni Proje Oluşturma
1.  Sol üstteki proje seçme menüsüne tıklayın (genelde "My Project" yazar).
2.  Açılan pencerede **"New Project"** (Yeni Proje) butonuna tıklayın.
3.  Projenize bir isim verin (örn: `GeldeSat`) ve **"Create"** deyin.
4.  Bildirimlerden projenin oluşturulduğunu görün ve **"Select Project"** diyerek projeyi seçin.

## 3. İzin Ekranını Ayarlama (OAuth Consent Screen)
1.  Sol menüden **"APIs & Services"** > **"OAuth consent screen"** seçeneğine gidin.
2.  **User Type** (Kullanıcı Tipi) olarak **External** (Harici) seçin ve **Create** butonuna basın.
3.  **App Information** kısmında:
    *   **App name:** Sitenizin adı (GeldeSat).
    *   **User support email:** Kendi email adresiniz.
    *   **Developer contact information:** Kendi email adresiniz.
4.  En alttaki **"Save and Continue"** butonuna basın.
5.  **Scopes** sayfasında bir şey değiştirmenize gerek yok, **"Save and Continue"** deyin.
6.  **Test Users** sayfasında da **"Save and Continue"** deyin.
7.  Özet sayfasında **"Back to Dashboard"**a tıklayın.

## 4. Kimlik Bilgilerini Oluşturma (Credentials)
1.  Sol menüden **"Credentials"** (Kimlik Bilgileri) seçeneğine tıklayın.
2.  Üstteki **"+ CREATE CREDENTIALS"** butonuna basıp **"OAuth client ID"**yi seçin.
3.  **Application type** olarak **"Web application"** seçin.
4.  **Authorized JavaScript origins** kısmına sitenizin ana adresini ekleyin:
    *   `https://siteniz.com` (veya `http://localhost:3000` geliştirme için)
5.  **Authorized redirect URIs** (Yönlendirme URL'leri) kısmına şunu EKLEMEK ZORUNDASINIZ:
    *   `https://siteniz.com/api/auth/callback/google`
    *   *(Eğer sunucu IP'si ile girecekseniz: `http://IP_ADRESI:3000/api/auth/callback/google`)*
6.  **"Create"** butonuna basın.

## 5. Bilgileri Kaydetme
Karşınıza **Client ID** ve **Client Secret** çıkacak. Bunları kopyalayın.

Sunucunuzdaki `.env` dosyasını açın ve şu satırları ekleyin (veya düzenleyin):

```env
GOOGLE_CLIENT_ID="buraya_client_id_yapistirin"
GOOGLE_CLIENT_SECRET="buraya_client_secret_yapistirin"
```

Ve dosyanın en üstündeki `NEXTAUTH_URL` ayarının `Authorized redirect URIs` ile uyumlu olduğundan emin olun.


```env
# Geliştirme ortamı (Localhost) için:
NEXTAUTH_URL="http://localhost:3000"

# Canlı sunucu için (yayına aldığınızda):
# NEXTAUTH_URL="https://siteniz.com"
```


Artık sitenizde Google ile giriş çalışacaktır.
