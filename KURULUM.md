# GeldeSat — kendi sunucunuza kurulum

Bu paket, GeldeSat ilan sitesini **kendi sunucunuzda** çalıştırmak içindir.
Giriş e-posta + şifre ile çalışır. Ödeme / doping / kredi kapalıdır.

## Ne gerekir

- Ubuntu 22.04 (veya benzeri) bir sunucu
- En az **2 GB RAM**, 20 GB disk
- Bir alan adı (ör. `ilan.siteniz.com`) ve **HTTPS**
- **Node.js 22** *veya* **Docker**

HTTPS olmadan üye girişi çalışmaz.

---

## Coolify / Nixpacks

Coolify varsayılan olarak Nixpacks kullanır. Bu projenin `nixpacks.toml` dosyası derlemeyi düzeltir.

**Ortam değişkenleri** (NEXTAUTH / AUTH_SECRET değil):

```
DATABASE_URL=postgres://...
BETTER_AUTH_URL=https://siteniz.com
BETTER_AUTH_SECRET=en-az-32-karakter-rastgele
VITE_AUTH_ENABLED=true
VITE_SELF_HOST=true
```

İsteğe bağlı: Build Pack olarak **Dockerfile** seçin — o zaman Nixpacks devreye girmez.

---

## 1) En kolay yol: Docker

Sunucuda:

```bash
# Docker yoksa (Ubuntu)
curl -fsSL https://get.docker.com | sh
```

Paketi açın:

```bash
unzip GeldeSat-sunucu.zip -d geldesat
cd geldesat
cp env.ornek .env
```

`.env` dosyasını düzenleyin:

```
BETTER_AUTH_URL=https://siteniz.com
BETTER_AUTH_SECRET=   # aşağıdaki komutun çıktısını yapıştırın
POSTGRES_PASSWORD=    # güçlü bir şifre
```

Gizli anahtar üretmek için:

```bash
openssl rand -hex 32
```

Sonra:

```bash
docker compose up -d --build
```

Site `http://SUNUCU:3000` üzerinde açılır. Bunu nginx / Cloudflare ile HTTPS’e alın (aşağıda).

Güncellemek için yeni zip’i açıp aynı klasörde tekrar `docker compose up -d --build`.

---

## 2) Docker olmadan (Node + PostgreSQL)

```bash
# PostgreSQL
sudo apt update
sudo apt install -y postgresql
sudo -u postgres createuser -P geldesat     # şifre sorun
sudo -u postgres createdb -O geldesat geldesat

# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Uygulama:

```bash
unzip GeldeSat-sunucu.zip -d geldesat
cd geldesat
npm ci
```

Ortam değişkenlerini sisteme verin (systemd örneği aşağıda) veya geçici olarak:

```bash
export DATABASE_URL='postgres://geldesat:SIFRE@127.0.0.1:5432/geldesat'
export BETTER_AUTH_URL='https://siteniz.com'
export BETTER_AUTH_SECRET='openssl rand -hex 32 çıktısı'
export VITE_AUTH_ENABLED=true
export VITE_SELF_HOST=true
export HOST=0.0.0.0
export PORT=3000
export NITRO_HOST=0.0.0.0
export NITRO_PORT=3000

npm run build:node
chmod +x baslat.sh
./baslat.sh
```

### systemd (sürekli açık kalsın)

`/etc/systemd/system/geldesat.service`:

```
[Unit]
Description=GeldeSat
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/geldesat
Environment=DATABASE_URL=postgres://geldesat:SIFRE@127.0.0.1:5432/geldesat
Environment=BETTER_AUTH_URL=https://siteniz.com
Environment=BETTER_AUTH_SECRET=gizli
Environment=VITE_AUTH_ENABLED=true
Environment=HOST=0.0.0.0
Environment=PORT=3000
Environment=NITRO_HOST=0.0.0.0
Environment=NITRO_PORT=3000
ExecStart=/usr/bin/node /var/www/geldesat/.output/server/index.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

İlk kurulumda bir kez `npm run db:migrate` çalıştırın, sonra:

```bash
sudo systemctl enable --now geldesat
```

---

## 3) HTTPS (nginx + Let’s Encrypt)

```nginx
server {
    listen 80;
    server_name siteniz.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        client_max_body_size 40m;
    }
}
```

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo ln -s /etc/nginx/sites-available/geldesat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d siteniz.com
```

`BETTER_AUTH_URL` tam olarak bu adrese eşit olmalı (`https://siteniz.com`, sonda `/` yok).

---

## İlk kullanım

1. Siteyi açın → **Kayıt** → e-posta + şifre.
2. İlk açılan hesap **yönetici** olur.
3. Profilinize `05XXXXXXXXX` formatında telefon ekleyin, sonra ilan verin.
4. İlk ilanınız otomatik yayına girer; sonrakiler onay bekler.

## Ne çalışır / ne çalışmaz

| Çalışır | Bu pakette kapalı |
|---|---|
| E-posta ile üyelik | Google ile giriş (Grok altyapısına bağlı) |
| İlan, mesaj, favori, arama | Ödeme, doping, kredi satışı |
| Kategori ağacı, yönetim paneli | SMS doğrulama |

İlan fotoğrafları veritabanında saklanır; çok ilan olursa disk ve Postgres şişer — yedek alın.

## Yedek

Docker:

```bash
docker compose exec db pg_dump -U geldesat geldesat > yedek.sql
```

Düz Postgres:

```bash
pg_dump -U geldesat geldesat > yedek.sql
```

## Sorun çıkarsa

- **Giriş olmuyor / çerez yok:** HTTPS yok veya `BETTER_AUTH_URL` adresi yanlış.
- **Boş sayfa:** `BETTER_AUTH_URL` ile tarayıcıdaki adres birebir aynı olmalı (`www` varsa ikisinde de olsun).
- **Veritabanı hatası:** `DATABASE_URL` ve Postgres ayakta mı bakın; `npm run db:migrate`.
