-- EasyJar update (2026-11-17): Temporary (walk-in / one-time) customers.
-- Run ONCE in phpMyAdmin (select the EasyJar database → SQL tab → paste → Go), BEFORE uploading
-- the new code, and AFTER 2026-11-15-offline-plan-payments.sql.
-- Only ADDS one column. Every existing customer becomes is_temporary = 0 (permanent), so the app
-- looks exactly as before until an owner chooses "Temporary" when adding a customer.
-- Same as `php artisan migrate` would do; the last statement records it so a later migrate won't repeat it.
ALTER TABLE customers
ADD COLUMN is_temporary TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

INSERT INTO
    migrations (migration, batch)
SELECT '2026_11_17_000001_add_is_temporary_to_customers', COALESCE(MAX(batch), 0) + 1
FROM migrations;