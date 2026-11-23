-- EasyJar update (2026-11-23): Invoice numbers on customer bills and manual bills (B-2026-00001 ...).
-- Run in phpMyAdmin (select the EasyJar database → SQL tab → paste → Go), BEFORE uploading the new code.
-- Only ADDS one new table: nothing existing is changed. Safe to run twice (IF NOT EXISTS / checks first).
-- Run it on PRE-PROD first, test a bill, then on LIVE. Same as `php artisan migrate` would do.
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

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_11_23_000001_create_invoices_table', (SELECT COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_11_23_000001_create_invoices_table');

-- Check afterwards:  SHOW CREATE TABLE invoices;
--                    SELECT migration FROM migrations WHERE migration LIKE '%invoices%';
