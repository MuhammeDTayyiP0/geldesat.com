# GeldeSat — proje arşivi

Tarih: 17 Eylül 2026

Sahibinden tarzı ilan sitesi. Ödeme / doping / kredi kapalı.
Kendi sunucuya kurulum için `KURULUM.md` dosyasına bakın.

## Klasörler

| Klasör | Ne işe yarar |
|---|---|
| `src/` | Site kodu (sayfalar, bileşenler, sunucu işlevleri) |
| `src/routes/` | Sayfalar: anasayfa, ilan, mesajlar, giriş, yönetim… |
| `src/components/` | Üst menü, kart, kategori seçici, formlar |
| `src/lib/server/` | İlan, mesaj, arama, hesap işlemleri |
| `migrations/` | Veritabanı şeması ve kategori kataloğu |
| `public/` | Favicon ve görseller |
| `scripts/` | Derleme, veritabanı göçü |
| `deploy/` | nginx ve systemd örnekleri |
| `server/` | Sunucu orta katmanı |

## Önemli dosyalar

| Dosya | |
|---|---|
| `KURULUM.md` | Kendi sunucuya kurulum |
| `README.md` | Kısa giriş |
| `Dockerfile` / `docker-compose.yml` | Tek komutta kurulum |
| `env.ornek` | Ayar şablonu (`.env` olarak kopyalanır) |
| `baslat.sh` | Docker’suz başlatma |
| `package.json` | Node bağımlılıkları |

## Bu arşive alınmayanlar

`node_modules`, derlenmiş çıktı, ekran görüntüleri, geçici dosyalar.
Kurulumda `npm ci` veya Docker bunları yeniden oluşturur.
