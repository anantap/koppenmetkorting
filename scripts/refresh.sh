#!/usr/bin/env bash
# Lokaal refresh-script voor de thuis-PC-stick (cron/systemd-timer).
#
# Bedoeld voor het scenario waarin je de Bol FTP-productfeed gebruikt: die
# vereist een gewhitelist vast IP, wat GitHub Actions-runners niet hebben.
# Dit script draait op een machine met een vast (of door Bol gewhitelist)
# IP, haalt de feed op, regenereert src/data/products.json + meta.json, en
# commit + pusht het resultaat. Cloudflare Pages deployt automatisch bij
# elke push naar de productiebranch.
#
# Vereisten: git remote met push-rechten (SSH-key of credential helper),
# node + npm, en (optioneel) lftp/curl als je BOL_FTP_* gebruikt.
#
# Gebruik: bewerk de variabelen hieronder of zet ze in .env, en koppel dit
# script aan een systemd-timer (zie deploy/koppenmetkorting-refresh.{service,timer})
# of een crontab-regel, bv.:
#   0 6 * * * /pad/naar/koppenmetkorting/scripts/refresh.sh >> /var/log/koppenmetkorting-refresh.log 2>&1

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
fi

echo "[refresh] $(date -Iseconds) start"

# TODO: vervang dit door een echte FTP-download zodra je Bol FTP-credentials
# hebt (bv. via lftp of curl ftp://...), die het resultaat naar
# data/live/bol-feed.csv schrijft. Zolang BOL_FEED_PATH niet gezet is, valt
# scripts/build-data.ts terug op de sample-CSV.
if [ -n "${BOL_FTP_HOST:-}" ]; then
  mkdir -p data/live
  echo "[refresh] downloaden Bol FTP-feed van ${BOL_FTP_HOST}..."
  # TODO: bevestig het exacte FTP-pad/bestandsnaam van de Bol productfeed.
  curl --fail --silent --show-error \
    "ftp://${BOL_FTP_USER}:${BOL_FTP_PASSWORD}@${BOL_FTP_HOST}/productfeed.csv" \
    -o data/live/bol-feed.csv
  export BOL_FEED_PATH="data/live/bol-feed.csv"
fi

npm ci
npm run build:data

if git diff --quiet -- src/data data/live; then
  echo "[refresh] geen wijzigingen, niets te committen."
  exit 0
fi

git config user.name "koppenmetkorting-refresh"
git config user.email "refresh@localhost"
git add src/data/products.json src/data/meta.json data/live 2>/dev/null || true
git commit -m "chore: refresh productdata (lokale cron)"
git push

echo "[refresh] $(date -Iseconds) klaar"
