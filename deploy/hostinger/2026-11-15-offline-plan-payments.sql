-- EasyJar update (2026-11-15): super admin can record plan money received OFFLINE
-- (cash / UPI / bank / cheque) when creating or editing a company. Shown beside online (Razorpay) payments.
-- Run ONCE in phpMyAdmin (select the EasyJar database → SQL tab → paste → Go), BEFORE uploading
-- the new code. Existing payments become mode = 'online', so nothing changes for them.
-- Same as `php artisan migrate` would do; the last statement records it so a later migrate won't repeat it.
ALTER TABLE billing_payments
MODIFY COLUMN razorpay_payment_id VARCHAR(40) NULL,
ADD COLUMN mode VARCHAR(10) NOT NULL DEFAULT 'online' AFTER currency,
ADD COLUMN method VARCHAR(20) NULL AFTER mode,
ADD COLUMN note VARCHAR(255) NULL AFTER method;

INSERT INTO
    migrations (migration, batch)
SELECT '2026_11_15_000001_add_offline_fields_to_billing_payments', COALESCE(MAX(batch), 0) + 1
FROM migrations;

¸