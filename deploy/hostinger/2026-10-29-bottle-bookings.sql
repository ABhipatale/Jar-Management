-- EasyJar update (2026-10-29): advance bookings can include 20 L bottles.
-- Run ONCE in phpMyAdmin (select the EasyJar database → SQL tab → paste → Go), after uploading laravel.zip
-- and AFTER 2026-10-28-bottles-and-deposits.sql. Existing bookings get 0 bottles; nothing else changes.
-- Same as `php artisan migrate` would do; the last statement records it so a later migrate won't repeat it.
ALTER TABLE bookings
  ADD COLUMN bottle_quantity INT UNSIGNED NOT NULL DEFAULT 0 AFTER jar_quantity;

INSERT INTO migrations (migration, batch)
SELECT '2026_10_29_000001_add_bottle_quantity_to_bookings', COALESCE(MAX(batch), 0) + 1 FROM migrations;
