#!/bin/sh
# GeldeSat — Docker olmadan, derlenmiş haliyle başlatma
set -eu
cd "$(dirname "$0")"

if [ ! -f .output/server/index.mjs ]; then
  echo "Önce derleyin: npm ci && npm run build:node"
  exit 1
fi

npm run db:migrate
exec node .output/server/index.mjs
