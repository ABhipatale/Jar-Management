-- EasyJar update (2026-10-30): "old udhari" (opening balance) when adding a customer.
-- Run ONCE in phpMyAdmin (select the EasyJar database → SQL tab → paste → Go), BEFORE or right
-- after uploading the new code. Existing customers get 0, so every current balance stays the same.
-- Same as `php artisan migrate` would do; the last statement records it so a later migrate won't repeat it.
ALTER TABLE customers
  ADD COLUMN opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER no_deposit;

INSERT INTO migrations (migration, batch)
SELECT '2026_10_30_000001_add_opening_balance_to_customers', COALESCE(MAX(batch), 0) + 1 FROM migrations;
