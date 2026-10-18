# GeldeSat — web

Türkiye odaklı ilan sitesi (TanStack Start + React 19 + Postgres + Better Auth).
Canlı ortam: Coolify üzerinde kendi sunucunuzda Node sunucusu olarak çalışır.

## Yerelde çalıştırma

```bash
npm ci
cp .env.example .env   # DATABASE_URL boşsa bellek içi PGLite kullanılır
npm run dev            # http://localhost:3000
```

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (port 3000) |
| `npm run build` | Üretim derlemesi → `.output/` |
| `npm run start:prod` | Migration'ları uygular, sunucuyu başlatır |
| `npm run db:migrate` | Yalnızca `migrations/*.sql` dosyalarını uygular |
| `npm test` / `npm run typecheck` / `npm run lint` | Kontroller |

## Yayına alma

Coolify kurulumu için **DEPLOYMENT_GUIDE.md**, Google ile giriş için
**GOOGLE_AUTH_SETUP.md** dosyasına bakın. Tüm ortam değişkenleri
`.env.example` içinde açıklamalı olarak listelenmiştir.

## Veritabanı

Şema tek kaynaktan gelir: `migrations/*.sql`. Dosyalar ada göre sırayla, her
biri bir kez uygulanır (`_migrations` tablosu). Yeni değişiklik için yeni bir
numaralı dosya ekleyin; uygulanmış bir dosyayı düzenlemeyin.
