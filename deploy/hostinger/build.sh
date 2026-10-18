#!/usr/bin/env bash
# Builds the two zips to upload to Hostinger (shared hosting, one domain):
#
#   out/public_html.zip  → extract into  domains/<domain>/public_html
#   out/laravel.zip      → extract into  domains/<domain>/laravel   (next to public_html)
#   out/env-for-server.txt → first deploy only: save as domains/<domain>/laravel/.env
#
# Usage (Git Bash, from the repo root):   bash deploy/hostinger/build.sh abnexa.in
set -euo pipefail

DOMAIN="${1:?usage: bash deploy/hostinger/build.sh <domain>   e.g. abnexa.in}"
KIT="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$KIT/../.." && pwd)"
OUT="$KIT/out"
WINTAR=/c/Windows/System32/tar.exe   # writes zips with forward slashes (Linux-safe)

# Empty (not delete) out/: Windows refuses to delete a folder that a terminal has open.
mkdir -p "$OUT"
find "$OUT" -mindepth 1 -delete
mkdir -p "$OUT/public_html" "$OUT/laravel"

echo "==> 1/4 React app (API on the same domain)"
# .env.production.local overrides frontend/.env (which points at the local API).
trap 'rm -f "$ROOT/frontend/.env.production.local"' EXIT
printf 'VITE_API_URL=\n' > "$ROOT/frontend/.env.production.local"
(cd "$ROOT/frontend" && npm run build)
cp -r "$ROOT/frontend/dist/." "$OUT/public_html/"
cp "$KIT/index.php" "$OUT/public_html/index.php"
cp "$KIT/htaccess.txt" "$OUT/public_html/.htaccess"
cp "$KIT/assets-htaccess.txt" "$OUT/public_html/assets/.htaccess"
cp -n "$ROOT/backend/public/robots.txt" "$OUT/public_html/" 2>/dev/null || true

echo "==> 2/4 Laravel app (without dev packages)"
(cd "$ROOT/backend" && tar -cf - \
  --exclude=./vendor --exclude=./node_modules --exclude=./tests --exclude=./public \
  --exclude='./.env' --exclude='./.env.*' --exclude=./.phpunit.result.cache --exclude=./phpunit.xml \
  --exclude=./Dockerfile.vercel --exclude=./Caddyfile.vercel --exclude=./vercel-start.sh --exclude=./.dockerignore \
  --exclude='./storage/logs/*' --exclude='./storage/framework/cache/data/*' \
  --exclude='./storage/framework/sessions/*' --exclude='./storage/framework/views/*' \
  --exclude='./bootstrap/cache/*.php' \
  .) | (cd "$OUT/laravel" && tar -xf -)
mkdir -p "$OUT/laravel/storage/logs" "$OUT/laravel/storage/app" "$OUT/laravel/storage/framework/cache/data" \
         "$OUT/laravel/storage/framework/sessions" "$OUT/laravel/storage/framework/views" "$OUT/laravel/bootstrap/cache"
(cd "$OUT/laravel" && composer install --no-dev --optimize-autoloader --no-interaction --quiet)
# Safety net: if this folder ever ends up inside a web root, nothing in it (.env!) is served.
printf 'Require all denied\nDeny from all\n' > "$OUT/laravel/.htaccess"

echo "==> 3/4 Server .env (only needed on the first deploy)"
local_env() { grep -E "^$1=" "$ROOT/backend/.env" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
cat > "$OUT/env-for-server.txt" <<EOF
APP_NAME="EasyJar"
APP_ENV=production
APP_KEY=$APP_KEY
APP_DEBUG=false
APP_URL=https://$DOMAIN
APP_TIMEZONE=Asia/Kolkata
APP_LOCALE=mr
APP_FALLBACK_LOCALE=en
FRONTEND_URL=https://$DOMAIN,https://www.$DOMAIN

# hPanel → Databases → Management (the host is "localhost" on Hostinger)
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=FILL_ME
DB_USERNAME=FILL_ME
DB_PASSWORD=FILL_ME

SUPERADMIN_NAME="$(local_env SUPERADMIN_NAME | tr -d '"')"
SUPERADMIN_EMAIL=$(local_env SUPERADMIN_EMAIL)
SUPERADMIN_PASSWORD=$(local_env SUPERADMIN_PASSWORD)
PLATFORM_NAME="EasyJar"
PLATFORM_NAME_MR="EasyJar"

RAZORPAY_KEY_ID=$(local_env RAZORPAY_KEY_ID)
RAZORPAY_KEY_SECRET=$(local_env RAZORPAY_KEY_SECRET)
RAZORPAY_WEBHOOK_SECRET=$(local_env RAZORPAY_WEBHOOK_SECRET)

VAPID_PUBLIC_KEY=$(local_env VAPID_PUBLIC_KEY)
VAPID_PRIVATE_KEY=$(local_env VAPID_PRIVATE_KEY)
VAPID_SUBJECT=$(local_env VAPID_SUBJECT)

LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=warning
SESSION_DRIVER=database
SESSION_LIFETIME=120
CACHE_STORE=database
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local
BCRYPT_ROUNDS=12
EOF

echo "==> 4/4 Zips"
rm -f "$OUT"/*.zip
(cd "$OUT/public_html" && "$WINTAR" -a -cf ../public_html.zip *  .htaccess)
(cd "$OUT/laravel" && "$WINTAR" -a -cf ../laravel.zip * .htaccess)

echo
echo "Done:"
ls -lh "$OUT"/*.zip "$OUT/env-for-server.txt"
