-- EasyJar update (2026-10-25): Marathi plan description.
-- Run ONCE in phpMyAdmin (select the EasyJar database → SQL tab → paste → Go), after uploading laravel.zip.
-- Same as `php artisan migrate` would do; the second line records it so a later migrate won't repeat it.
ALTER TABLE plans ADD COLUMN description_mr VARCHAR(500) NULL AFTER description;
INSERT INTO migrations (migration, batch)
SELECT '2026_10_25_000001_add_description_mr_to_plans', COALESCE(MAX(batch), 0) + 1 FROM migrations;
