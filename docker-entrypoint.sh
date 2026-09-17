#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "HATA: DATABASE_URL tanımlı değil."
  exit 1
fi
if [ -z "${BETTER_AUTH_SECRET:-}" ]; then
  echo "HATA: BETTER_AUTH_SECRET tanımlı değil. En az 32 karakter rastgele bir dize üretin."
  exit 1
fi
if [ -z "${BETTER_AUTH_URL:-}" ]; then
  echo "HATA: BETTER_AUTH_URL tanımlı değil. Örnek: https://siteniz.com"
  exit 1
fi

echo "[geldesat] veritabanı şeması uygulanıyor…"
node scripts/migrate.mjs

echo "[geldesat] sunucu başlıyor…"
exec node .output/server/index.mjs
