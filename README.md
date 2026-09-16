# GeldeSat

Türkiye ilan platformu — emlak, vasıta ve ikinci el.

Grok oturumundaki güncel kaynak, Grok workspace dosyaları (`.grok`, ekran görüntüleri, PWA köprüsü) ayıklanmış hali.

## Gereksinimler

- Node.js 22+
- npm

## Kurulum

```bash
npm install
npm run dev
```

Tarayıcı: [http://localhost:8080](http://localhost:8080)

İlk açılışta veritabanı migrasyonları çalışır; bir kez biraz sürebilir.

## Veritabanı

- **Yerel:** `DATABASE_URL` yoksa gömülü PGLite kullanılır. Ekstra kurulum gerekmez.
- **Canlı:** Postgres / Neon bağlantısını `DATABASE_URL` olarak verin.

Şema: `migrations/` klasörü.

## Production derleme

```bash
npm run build
```

Çıktı Vercel (Nitro) preset’ine göredir. Vercel’e atabilir veya Node sunucuda çalıştırabilirsiniz.

## Dizin

```
src/routes/        sayfalar
src/components/    arayüz
src/lib/server/    ilan, hesap, mesaj
migrations/        veritabanı
public/            favicon, og görseli
```
