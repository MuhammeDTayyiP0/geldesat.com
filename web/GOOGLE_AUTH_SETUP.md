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
    *   `https://www.geldesat.com` (geliştirme için ayrıca `http://localhost:3000`)
5.  **Authorized redirect URIs** (Yönlendirme URL'leri) kısmına şunu EKLEMEK ZORUNDASINIZ:
    *   `https://www.geldesat.com/api/auth/callback/google`
    *   `http://localhost:3000/api/auth/callback/google` (geliştirme için)
6.  **"Create"** butonuna basın.

## 5. Bilgileri Coolify'a Girme
Karşınıza **Client ID** ve **Client Secret** çıkacak. Bunları Coolify'da
uygulamanın **Environment Variables** bölümüne ekleyin:

```env
GOOGLE_CLIENT_ID=buraya_client_id
GOOGLE_CLIENT_SECRET=buraya_client_secret
# Google butonunu göstermek için; Coolify'da "Build Variable" olarak işaretleyin
VITE_GOOGLE_AUTH_ENABLED=true
```

`BETTER_AUTH_URL` değeri Google'a girdiğiniz adresle aynı olmalıdır
(ör. `https://www.geldesat.com`). Ardından Coolify'da **Redeploy** yapın.

Not: Şifreyle açılmış bir hesap, e-postası doğrulanmadıysa Google girişiyle
otomatik birleştirilmez (hesap ele geçirmeyi önlemek için). SMTP ayarlıysa yeni
kayıtlar doğrulama e-postası alır.
