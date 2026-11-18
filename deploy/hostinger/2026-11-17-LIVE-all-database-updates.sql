-- ════════════════════════════════════════════════════════════════════════════════════════
--  EasyJar LIVE database update (2026-11-17)  — ALL updates in one file
--  Database: the LIVE one (u848097686_easyjar).  Server: MariaDB.
--
--  HOW TO RUN: hPanel → Databases → phpMyAdmin → click the LIVE database → SQL tab →
--  paste this whole file → Go.  Do it BEFORE uploading the new laravel.zip / public_html.zip.
--  First export the live database (phpMyAdmin → Export) as a backup.
--
--  It only ADDS columns (and records them in `migrations`). Nothing is deleted or changed in
--  existing rows. It is safe to run twice: every step checks first ("IF NOT EXISTS").
--
--  Contains:
--   1) 2026-11-15  Offline plan payments (cash / UPI / bank recorded by the super admin)
--                  billing_payments: razorpay_payment_id becomes optional + mode, method, note
--   2) 2026-11-17  Temporary (walk-in) customers
--                  customers.is_temporary, companies.temporary_enabled  (both OFF / 0 by default)
-- ════════════════════════════════════════════════════════════════════════════════════════

-- 1) Offline plan payments ------------------------------------------------------------
ALTER TABLE billing_payments
  MODIFY COLUMN razorpay_payment_id VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS mode VARCHAR(10) NOT NULL DEFAULT 'online' AFTER currency,
  ADD COLUMN IF NOT EXISTS method VARCHAR(20) NULL AFTER mode,
  ADD COLUMN IF NOT EXISTS note VARCHAR(255) NULL AFTER method;

-- 2) Temporary customers --------------------------------------------------------------
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_temporary TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS temporary_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER routes_enabled;

-- 3) Tell Laravel these migrations are done (so a later `php artisan migrate` skips them) --
SET @batch := (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations);

INSERT INTO migrations (migration, batch)
SELECT '2026_11_15_000001_add_offline_fields_to_billing_payments', @batch FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = '2026_11_15_000001_add_offline_fields_to_billing_payments');

INSERT INTO migrations (migration, batch)
SELECT '2026_11_17_000001_add_is_temporary_to_customers', @batch FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = '2026_11_17_000001_add_is_temporary_to_customers');

-- ── Check afterwards (run these separately; each should return a row) ──
--   SHOW COLUMNS FROM billing_payments LIKE 'mode';
--   SHOW COLUMNS FROM customers LIKE 'is_temporary';
--   SHOW COLUMNS FROM companies LIKE 'temporary_enabled';
--   SELECT migration FROM migrations WHERE migration IN
--     ('2026_11_15_000001_add_offline_fields_to_billing_payments','2026_11_17_000001_add_is_temporary_to_customers');
