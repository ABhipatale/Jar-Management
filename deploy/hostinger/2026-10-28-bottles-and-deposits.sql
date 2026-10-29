-- EasyJar update (2026-10-28): 20 L bottles + refundable deposits (both OFF for every company).
-- Run ONCE in phpMyAdmin (select the EasyJar database → SQL tab → paste → Go), after uploading laravel.zip.
-- Only adds columns with defaults: existing entries become "jar" with ₹0 deposit, nothing else changes.
-- Same as `php artisan migrate` would do; the last statement records it so a later migrate won't repeat it.
ALTER TABLE companies
  ADD COLUMN bottles_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN deposit_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER bottles_enabled;

ALTER TABLE customers
  ADD COLUMN takes_jar TINYINT(1) NOT NULL DEFAULT 1 AFTER status,
  ADD COLUMN takes_bottle TINYINT(1) NOT NULL DEFAULT 0 AFTER takes_jar,
  ADD COLUMN jar_rate DECIMAL(10, 2) NULL AFTER takes_bottle,
  ADD COLUMN bottle_rate DECIMAL(10, 2) NULL AFTER jar_rate,
  ADD COLUMN no_deposit TINYINT(1) NOT NULL DEFAULT 0 AFTER bottle_rate;

ALTER TABLE jar_transactions
  ADD COLUMN product VARCHAR(10) NOT NULL DEFAULT 'jar' AFTER transaction_type,
  ADD COLUMN deposit_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER advance_amount,
  ADD INDEX jar_transactions_customer_id_product_index (customer_id, product);

ALTER TABLE jars
  ADD COLUMN product VARCHAR(10) NOT NULL DEFAULT 'jar' AFTER jar_number,
  ADD INDEX jars_company_id_product_status_index (company_id, product, status);

ALTER TABLE customer_ledger
  ADD COLUMN product VARCHAR(10) NOT NULL DEFAULT 'jar' AFTER entry_type,
  ADD COLUMN deposit DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER udhari,
  ADD COLUMN bottle_balance INT NOT NULL DEFAULT 0 AFTER jar_balance,
  ADD COLUMN deposit_balance DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER bottle_balance;

INSERT INTO migrations (migration, batch)
SELECT '2026_10_28_000001_add_bottles_and_deposits', COALESCE(MAX(batch), 0) + 1 FROM migrations;
