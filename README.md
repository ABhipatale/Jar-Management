# EasyJar

A phone-first app for water-jar businesses. One deployment serves many companies: each company has its own login, data, name, logo and installable app (the design and colours are the same for everyone), and the platform owner (super admin) registers and manages the companies.

```
React PWA (Vercel)  →  Laravel 12 REST API  →  MySQL
frontend/              backend/
```

## Companies (multi-tenant)

- **One database, `company_id` on every business table.** Customers, jars, jar entries, payments, ledger, expenses, settings, reminders, bookings and push subscriptions all belong to one company.
- **The company comes from the login, never from the request.** Every Eloquent model uses the `BelongsToCompany` trait: queries only see the logged-in user's company, and new rows get its id. Query-builder code (reports, balances) uses `CurrentCompany::table()`, which adds the same filter. With no company known, queries return nothing and writes fail. Background work (the cron job, seeders, the admin panel) sets the company explicitly with `CurrentCompany::run()`.
- **Roles:** `super_admin` (no company; manages companies), `owner` (full access to their company), `staff` (column exists; not used yet).
- **Logins are unique across the platform** (email and mobile), because one login page serves every company and the login decides which company opens.
- **Suspended or expired companies** cannot log in, and their open sessions get a 403 with the reason. The cron job skips them.
- **Super-admin panel** (`/admin` in the app, `/api/admin/*`): list, register, edit, suspend/activate, extend the plan, reset the owner's password, upload the logo, delete (soft), and **Log in as company** for support (a 2-hour owner session with a banner; logged). Every action is written to `admin_audit_logs`.
- **Branding:** the name, short name and logo are stored on the company; the app's design and colours are the same for every company. The server generates the app icons from the logo (192, 512, maskable and Apple 180 px) and stores them in the database, because Vercel's filesystem is temporary.
- **Installed app:** after login, the app points `<link rel="manifest">` at `/api/companies/<slug>/manifest.webmanifest`, so *Install app* / *Add to Home Screen* uses the company's name and icon. The branding is saved on the phone, so an installed company app opens with its own splash, even offline. Before anyone logs in, the platform's name and icon are shown.
- **Offline data on the phone** (cached settings, offline outbox) is stored per company, so one phone can be used by two companies without mixing data.

**Plans & payments (Razorpay):**
- The super admin manages plans (**Admin → Plans**: add, edit price/interval, hide, delete). It starts with **Monthly ₹250** and **Yearly ₹1999**.
- Owners pay in **Settings → Plan & payment** (also linked from the "plan ends soon" banner). Payment is a **Razorpay subscription**, so it renews automatically every month/year; the owner can turn auto-pay off.
- Each payment moves the company's end date forward by one month/year (from the current end date, or from today if it already ended). Renewals arrive by webhook (`POST /api/billing/webhook`, signature-checked). A payment is counted once even if it arrives twice.
- 3 days before the end date (when auto-pay is off), the app shows a banner and phones get a notification once a day.
- When the plan has ended, every user of the company can still log in but sees only the plans screen; all data is kept.
- Until `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are set, online payment is switched off (plans still show, with the support number); extend plans by hand on the company page.

**Installed-app limits** (set by the phone, not the app): Android Chrome picks up a renamed company or a new icon when it re-checks the manifest, which can take up to a day. iPhone keeps the name and icon from the moment of *Add to Home Screen*; to see a new logo there, remove the app and add it again.

## What it does

- **Dashboard**: today's jars given/returned, jars in the shop and with customers, cash, udhari, total pending, expenses and net cash. Filters: Today / Yesterday / This Week / This Month / Custom.
- **Daily Entry**: give or return jars. Amount, udhari and advance are worked out automatically. After saving, one tap sends the WhatsApp message.
- **Customers**: add, edit, view, soft delete, call, WhatsApp, udhari reminder and full history.
- **Payments**: Cash / UPI / Bank. If a payment is more than the pending amount, it must be ticked as an advance. Sends a WhatsApp receipt.
- **Jars**: total, available, with customers, damaged and lost, managed by quantity. You can turn on tracking by jar number (JAR-001…) in Settings.
- **Reports**: Daily, Weekly, Monthly, Customer Ledger, Jar Status, Cash, Udhari and Pending. Each has filters and search, plus Excel, PDF and Print.
- **Expenses**: a simple list that feeds Net Cash (cash collection minus cash expenses).
- **WhatsApp**: uses click-to-chat (`wa.me`). No WhatsApp API is needed. The Marathi message templates can be edited in Settings.
- **PWA**: can be installed on Android and iPhone, has a splash screen, and shows the last-seen data when offline. Entries saved offline sync later and are never duplicated (see below).

## Business rules (all calculated on the server)

| Value | Formula |
|---|---|
| Customer current jars | SUM(given) − SUM(returned) |
| Customer pending | SUM(udhari) − SUM(advance) − SUM(payments) (negative = advance credit) |
| Available jars | Total jars − jars with customers − damaged − lost |
| Cash collection | money received on jar entries + **cash** payments |
| Udhari | udhari created on jar entries in the period |
| Net cash | cash collection − cash expenses |

The server re-checks every number the app sends. For example, `amount` is always `qty × rate` and `udhari` is always `amount − paid`. Each jar entry or payment runs inside a database transaction with a row lock on the customer. The ledger (`customer_ledger`) is rebuilt in the same transaction, so balances stay correct after back-dated entries and deletes.

The server blocks:
- negative quantities and payments
- returning more jars than the customer holds
- a payment above the pending amount unless it is marked as an advance
- an invalid mobile number, transaction type or payment mode
- deleting a customer who still holds jars or owes money (mark them Inactive instead)
- deleting a "give" entry after those jars have been returned

**Offline safety:** each form gets a `client_uuid` when it opens. The jar-entry, payment and expense tables have a UNIQUE index on that column. If the phone has no internet, the save waits in an outbox on the phone and syncs automatically later. If the same save reaches the server twice, the server returns the existing record instead of creating a new one.

## Run locally

Requirements: PHP 8.2+ with `pdo_mysql`, Composer, Node 20+, and MySQL 8+ (or MariaDB 10.6+, e.g. from XAMPP).

```bash
# API
cd backend
composer install
cp .env.example .env            # set DB_* for your MySQL (create the empty database first), APP_DEBUG=true, APP_ENV=local
php artisan key:generate
php artisan migrate --seed      # creates tables + the super admin (SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD)
php artisan db:seed --class=DemoSeeder   # optional sample customers for the first company (local only)
php artisan serve               # http://127.0.0.1:8000

# App
cd ../frontend
npm install
cp .env.example .env            # VITE_API_URL=http://127.0.0.1:8000
npm run dev                     # http://localhost:5173 (/api is proxied to VITE_API_URL)
```

Log in with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`, register a company with its owner login, then log in as that owner (or use **Log in as company**). **Change the passwords after the first login.**

**Upgrading an existing single-shop database:** `php artisan migrate` creates company #1 (slug `sai`) from the saved shop settings and moves every existing row and user into it. Nothing is lost; the old admin login keeps working as that company's owner.

Tests (these use in-memory SQLite, so no database setup is needed): `cd backend && php artisan test`. They include tenant isolation (company B cannot read or change company A's data by id, list, report or validation), the super-admin panel, branding/manifest/icons and the per-company cron.

## Deploy (one Vercel project, two services)

The root `vercel.json` deploys both parts as a single Vercel project on one domain:

| Path | Service | What it is |
|---|---|---|
| `/api/*`, `/up` | `backend` | Laravel API, built from `backend/Dockerfile.vercel` (FrankenPHP container) |
| everything else | `frontend` | the React PWA (static Vite build) |

The app calls `/api/...` on its own domain, so no CORS setup or `VITE_API_URL` is needed in production.

1. **MySQL**: create a hosted MySQL 8 database (for example Aiven, TiDB Cloud or PlanetScale, in a Mumbai or Singapore region) and copy its connection details.
2. **Vercel project**: import the GitHub repo and leave Root Directory at the **repository root**, where `vercel.json` lives. Services is a beta feature, so your Vercel team may need it enabled.
3. **Environment variables** (Project → Settings → Environment Variables):
   ```
   APP_KEY=base64:...        # php artisan key:generate --show
   APP_DEBUG=false
   APP_TIMEZONE=Asia/Kolkata
   DB_CONNECTION=mysql
   DB_URL=mysql://user:pass@host:3306/jar_management
   MYSQL_ATTR_SSL_CA=/etc/ssl/certs/ca-certificates.crt   # only if the host requires TLS
   SUPERADMIN_EMAIL=you@example.com
   SUPERADMIN_PASSWORD=<strong password>
   PLATFORM_NAME=EasyJar
   ```
4. **Deploy.** When a backend instance starts, `backend/vercel-start.sh` runs `migrate` and the seeder. Both are safe to repeat, and the seeder only creates the super admin and missing default settings. To run migrations yourself instead, set `RUN_MIGRATIONS=false`.
5. **Check** that `https://<your-app>.vercel.app/up` shows "Application up", then log in.

The backend's filesystem on Vercel is temporary. Logs go to Vercel's runtime logs, the cache and login throttling use the database, and all business data is in MySQL.

Local development without Vercel works as before: run `php artisan serve` for the API and `npm run dev` for the app, with `VITE_API_URL` set in `frontend/.env`. Running `vercel dev` also works, but it needs Docker to build the backend container.

**Install on a phone**: open the Vercel URL and **log in first** (so the install uses the company's name and icon). On Android (Chrome), tap ⋮ → *Install app*. On iPhone (Safari), tap Share → *Add to Home Screen*.

## Notes

- **Name and logo** of each company are set in **Settings → Branding** (or by the super admin). They are used in the header, reports, print/PDF, Excel, WhatsApp messages, phone notifications and the installed app. Companies without a logo use the default water-drop icon in `frontend/public/icons`.
- Developed by **AB Technology Services** · 7666287015.
- **PDF export** uses the browser's print dialog ("Save as PDF"). Marathi names print correctly this way, whereas JavaScript PDF libraries garble Devanagari unless fonts are embedded.
- **Jar stock** is one row per jar in the `jars` table, even in quantity mode. This gives exact totals and dated damaged/lost counts for the monthly report.
