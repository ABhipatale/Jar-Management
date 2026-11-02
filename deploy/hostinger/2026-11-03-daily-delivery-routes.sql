-- EasyJar update (2026-11-03): Daily delivery routes (morning / evening).
-- Run ONCE in phpMyAdmin (select the EasyJar database → SQL tab → paste → Go), BEFORE uploading
-- the new code, and AFTER 2026-11-02-customer-old-jars.sql.
-- Only ADDS columns / a table: no existing data changes. Every company starts with the feature OFF
-- and every customer on no route, so the app looks exactly as before until the super admin
-- switches "रोजची डिलिव्हरी फेरी" on for a company.
-- Same as `php artisan migrate` would do; the last statement records it so a later migrate won't repeat it.
ALTER TABLE companies
  ADD COLUMN routes_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER deposit_enabled;

ALTER TABLE customers
  ADD COLUMN route_morning TINYINT(1) NOT NULL DEFAULT 0 AFTER opening_bottles,
  ADD COLUMN route_evening TINYINT(1) NOT NULL DEFAULT 0 AFTER route_morning,
  ADD COLUMN morning_qty SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER route_evening,
  ADD COLUMN evening_qty SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER morning_qty,
  ADD COLUMN schedule_type VARCHAR(10) NOT NULL DEFAULT 'daily' AFTER evening_qty,
  ADD COLUMN schedule_every TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER schedule_type,
  ADD COLUMN schedule_days VARCHAR(20) NULL AFTER schedule_every,
  ADD COLUMN morning_order INT UNSIGNED NULL AFTER schedule_days,
  ADD COLUMN evening_order INT UNSIGNED NULL AFTER morning_order,
  ADD COLUMN delivery_note VARCHAR(255) NULL AFTER evening_order;

CREATE TABLE route_stops (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  route_date DATE NOT NULL,
  session VARCHAR(10) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(10) NOT NULL DEFAULT 'pending',
  skip_reason VARCHAR(40) NULL,
  jar_transaction_id BIGINT UNSIGNED NULL,
  added_manually TINYINT(1) NOT NULL DEFAULT 0,
  done_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY route_stops_company_id_route_date_session_customer_id_unique (company_id, route_date, session, customer_id),
  KEY route_stops_company_id_route_date_session_position_index (company_id, route_date, session, position),
  CONSTRAINT route_stops_company_id_foreign FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT route_stops_customer_id_foreign FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
  CONSTRAINT route_stops_jar_transaction_id_foreign FOREIGN KEY (jar_transaction_id) REFERENCES jar_transactions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO migrations (migration, batch)
SELECT '2026_11_03_000001_add_daily_delivery_routes', COALESCE(MAX(batch), 0) + 1 FROM migrations;
