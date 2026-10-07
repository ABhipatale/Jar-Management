#!/bin/sh
# Container start-up on Vercel.
#
# The web server must start listening on $PORT immediately, or Vercel reports
# "could not connect to $PORT" and the request fails. So nothing slow may run before it.

# Writable Laravel storage (see LARAVEL_STORAGE_PATH in Dockerfile.vercel).
mkdir -p /tmp/storage/app /tmp/storage/logs \
         /tmp/storage/framework/cache/data /tmp/storage/framework/views /tmp/storage/framework/sessions

# Vercel has no "pre-deploy" hook, so schema changes are applied in the background once an
# instance starts. Both commands are safe to repeat (migrate skips what is done; the seeder only
# creates the admin / default settings if missing). A failure is logged but never stops the server.
# Set RUN_MIGRATIONS=false to skip this and run `php artisan migrate --force` yourself.
if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  (
    php artisan migrate --force --no-interaction \
      && php artisan db:seed --force --no-interaction \
      || echo "vercel-start: migrate/seed FAILED (see error above); the API is still running" >&2
  ) &
fi

exec frankenphp run --config /etc/caddy/Caddyfile
