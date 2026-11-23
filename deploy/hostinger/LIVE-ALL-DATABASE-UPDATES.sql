-- ════════════════════════════════════════════════════════════════════════════════════════
--  EasyJar LIVE database — ALL updates in ONE file (2026-11-23)
--  Database: the LIVE one (u848097686_easyjar).  Server: MariaDB.
--
--  HOW TO RUN: hPanel → Databases → phpMyAdmin → click the LIVE database → SQL tab →
--  paste this whole file → Go.  Do it BEFORE uploading the new laravel.zip / public_html.zip.
--  First export the live database (phpMyAdmin → Export) as a backup.
--
--  It only ADDS columns / one table (and records them in `migrations`). Nothing is deleted or
--  changed in existing rows. SAFE TO RUN AGAIN: every step checks first, so anything already
--  applied is simply skipped.
--
--  Contains:
--   1) 2026-11-15  Offline plan payments   → billing_payments: mode, method, note (+ optional razorpay id)
--   2) 2026-11-17  Temporary customers     → customers.is_temporary, companies.temporary_enabled (both off / 0)
--   3) 2026-11-23  Invoice numbers         → new table `invoices`  (B-2026-00001 ...)
--   (Default payment cash/udhari and bottle priority are plain settings: no database change.)
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

-- 3) Invoice numbers ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `company_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL,
  `year` SMALLINT UNSIGNED NOT NULL,
  `seq` INT UNSIGNED NOT NULL,
  `number` VARCHAR(30) NOT NULL,
  `key` VARCHAR(120) NOT NULL,
  `period_from` DATE NULL,
  `period_to` DATE NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoices_company_id_key_unique` (`company_id`, `key`),
  UNIQUE KEY `invoices_company_id_number_unique` (`company_id`, `number`),
  UNIQUE KEY `invoices_company_id_year_seq_unique` (`company_id`, `year`, `seq`),
  KEY `invoices_customer_id_foreign` (`customer_id`),
  CONSTRAINT `invoices_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoices_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Tell Laravel these migrations are done (so a later `php artisan migrate` skips them) --
SET @batch := (SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations);

INSERT INTO migrations (migration, batch)
SELECT '2026_11_15_000001_add_offline_fields_to_billing_payments', @batch FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = '2026_11_15_000001_add_offline_fields_to_billing_payments');

INSERT INTO migrations (migration, batch)
SELECT '2026_11_17_000001_add_is_temporary_to_customers', @batch FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = '2026_11_17_000001_add_is_temporary_to_customers');

INSERT INTO migrations (migration, batch)
SELECT '2026_11_23_000001_create_invoices_table', @batch FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE migration = '2026_11_23_000001_create_invoices_table');

-- ── Check afterwards (run separately; each should return a row) ──
--   SHOW COLUMNS FROM billing_payments LIKE 'mode';
--   SHOW COLUMNS FROM customers LIKE 'is_temporary';
--   SHOW COLUMNS FROM companies LIKE 'temporary_enabled';
--   SHOW TABLES LIKE 'invoices';
--   SELECT migration FROM migrations WHERE migration IN
--     ('2026_11_15_000001_add_offline_fields_to_billing_payments','2026_11_17_000001_add_is_temporary_to_customers','2026_11_23_000001_create_invoices_table');
