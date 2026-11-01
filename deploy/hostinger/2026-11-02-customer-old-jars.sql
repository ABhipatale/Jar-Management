-- EasyJar update (2026-11-02): "old jars / old bottles" when adding a customer.
-- Run ONCE in phpMyAdmin (select the EasyJar database → SQL tab → paste → Go), BEFORE uploading
-- the new code, and AFTER 2026-10-30-customer-old-udhari.sql. Existing customers get 0, so every
-- current balance and the jar stock stay the same.
-- Same as `php artisan migrate` would do; the last statement records it so a later migrate won't repeat it.
ALTER TABLE customers
  ADD COLUMN opening_jars INT UNSIGNED NOT NULL DEFAULT 0 AFTER opening_balance,
  ADD COLUMN opening_bottles INT UNSIGNED NOT NULL DEFAULT 0 AFTER opening_jars;

INSERT INTO migrations (migration, batch)
SELECT '2026_11_02_000001_add_opening_jars_to_customers', COALESCE(MAX(batch), 0) + 1 FROM migrations;
