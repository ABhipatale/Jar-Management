# Deploy on Hostinger (shared hosting)

One domain serves both parts: the React app is static files in `public_html`, and `/api/*` goes to
Laravel through `public_html/index.php`. Laravel itself sits in `laravel/` next to `public_html`, outside the web root.

```
domains/abnexa.in/
├── public_html/   ← out/public_html.zip  (React build + index.php + .htaccess)
└── laravel/       ← out/laravel.zip      (Laravel + vendor, no dev packages) + .env
```

**Subdomain** (e.g. `easyjar.abnexa.in`, created as its own website in hPanel): the layout is the same, but under
`domains/easyjar.abnexa.in/`. If Hostinger instead gave the subdomain the folder `domains/abnexa.in/public_html/easyjar`,
put `laravel/` next to that `easyjar` folder (so: `public_html/laravel`). `laravel/.htaccess` blocks all web access to it.

## Build (on your PC, Git Bash, repo root)

```bash
bash deploy/hostinger/build.sh abnexa.in
```

The script writes these files to `deploy/hostinger/out/` (git-ignored, because they contain secrets):
- `public_html.zip` and `laravel.zip`
- `env-for-server.txt`: a production `.env` with a fresh `APP_KEY`, plus the Razorpay and VAPID keys from `backend/.env`. Use it on the first deploy only.

## First deploy (hPanel)

1. **PHP:** go to Advanced → PHP Configuration and pick **PHP 8.3** (8.2 or newer). Under Extensions, make sure `gd`, `pdo_mysql`, `fileinfo`, `curl` and `mbstring` are ticked.
2. **Database:** go to Databases → Management and create a database and a user. Write down the full names (`u123456789_…`) and the password.
3. **Data:** open phpMyAdmin, select that database, then go to Import and choose `database.sql`. To export your local data again, run:
   `/c/xampp/mysql/bin/mysqldump.exe -u root --default-character-set=utf8mb4 --single-transaction jarmanagement > deploy/hostinger/out/database.sql`
   If you want an empty start instead, skip this step and run step 7 over SSH.
4. **Files:** go to File manager → `domains/abnexa.in/`.
   - In `public_html`, delete Hostinger's placeholder files (`default.php`, etc.). Upload `public_html.zip` into `public_html` and extract it there.
   - Create a folder named `laravel` next to `public_html`, then upload `laravel.zip` into it and extract it.
5. **.env:** inside `laravel/`, create a file named `.env`. Paste in the contents of `env-for-server.txt` and fill in `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD`.
6. **SSL:** go to Security → SSL. Install the free certificate and turn on **Force HTTPS**.
7. **(Only with SSH, for an empty database):** connect over SSH (Advanced → SSH Access), then run `cd domains/abnexa.in/laravel && php artisan migrate --force && php artisan db:seed --force`.
8. **Check:** `https://abnexa.in/up` should show a green page. Then open `https://abnexa.in` and log in.
9. **Reminders (cron):** go to Advanced → Cron Jobs. Add a *Custom* job with this command:
   `curl -s https://abnexa.in/api/cron/reminders > /dev/null`
   Add it three times, at **06:30**, **09:00** and **19:30 India time**. If the cron page says the server runs on UTC, use 01:00, 03:30 and 14:00 instead.
10. **Razorpay (optional backup):** in the Razorpay dashboard, add the webhook `https://abnexa.in/api/billing/webhook` with the event `order.paid`. Put its secret in `RAZORPAY_WEBHOOK_SECRET` in `laravel/.env`.

## Updating later

1. Run `bash deploy/hostinger/build.sh abnexa.in` again.
2. Upload and extract **both zips** over the old files. Don't touch `laravel/.env`, and don't upload `env-for-server.txt` again.
3. If the update has new migrations (new files in `backend/database/migrations`), run them over SSH:
   `cd domains/abnexa.in/laravel && php artisan migrate --force`
4. Phones pick up the new app version by themselves (the service worker is never cached).

## Pre-prod (test before live)

Same hosting, completely separate: its own frontend folder, backend folder and database.

| | Live | Pre-prod |
|---|---|---|
| URL | `easyjar.abnexa.in` | `preproduction-easyjar.abnexa.in` |
| Frontend | `public_html/easyjar` | `public_html/preproduction-easyjar` |
| Backend | `laravel/` | `preproduction-easyjar-laravel/` |
| Build | `bash deploy/hostinger/build.sh easyjar.abnexa.in` → `out/` | `bash deploy/hostinger/build.sh preproduction-easyjar.abnexa.in preproduction-easyjar-laravel` → `out-preproduction-easyjar-laravel/` |

- Pre-prod's login page says **EasyJar PREPROD**.
- Give pre-prod its **own database**; never point it at the live one.
- **No cron job** for pre-prod (real customers must not get reminders from test data).
- Razorpay: pre-prod uses the live keys, so test payments are **real money**.
- Workflow: build → upload to pre-prod → test → build live → upload to live.
