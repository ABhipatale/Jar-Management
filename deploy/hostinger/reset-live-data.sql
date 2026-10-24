-- ─────────────────────────────────────────────────────────────────────────────
-- EasyJar: wipe ALL company data on the live server.
--
-- KEEPS:   the super admin login(s), the plans (Monthly / Yearly …), the migrations table.
-- DELETES: every company, every owner/staff login, customers, jar entries, payments,
--          udhari ledger, bookings, reminders, expenses, settings, logos, Razorpay
--          orders/payment history, push subscriptions, the admin activity log,
--          sessions, cache and queued jobs.
--
-- Uses DELETE in child → parent order, so it works even where TRUNCATE is refused
-- (#1701 "Cannot truncate a table referenced in a foreign key constraint").
-- Safe to run again if an earlier attempt stopped half-way.
--
-- THIS CANNOT BE UNDONE. Export a backup first (phpMyAdmin → Export → Quick → SQL → Go).
-- Run it in phpMyAdmin: select the EasyJar database → SQL tab → paste → Go.
-- ─────────────────────────────────────────────────────────────────────────────

-- Business data (children first)
DELETE FROM customer_ledger;
DELETE FROM reminders;
DELETE FROM bookings;
DELETE FROM payments;
DELETE FROM jar_transactions;
DELETE FROM jars;
DELETE FROM expenses;
DELETE FROM customers;
DELETE FROM settings;
DELETE FROM company_assets;
DELETE FROM push_subscriptions;

-- Billing history
DELETE FROM billing_payments;
DELETE FROM billing_orders;

-- Activity log of the super admin (it only refers to companies that are gone)
DELETE FROM admin_audit_logs;

-- Logins: keep only the super admin(s) and their login tokens
DELETE FROM personal_access_tokens
 WHERE tokenable_id NOT IN (SELECT id FROM users WHERE role = 'super_admin');
DELETE FROM users WHERE role <> 'super_admin';
DELETE FROM password_reset_tokens;

-- Companies (after everything that points to them)
DELETE FROM companies;

-- Framework housekeeping
DELETE FROM sessions;
DELETE FROM cache;
DELETE FROM cache_locks;
DELETE FROM jobs;
DELETE FROM job_batches;
DELETE FROM failed_jobs;

-- Check: should show 0 companies / 0 customers, your super admin, and your plans.
SELECT (SELECT COUNT(*) FROM companies)  AS companies,
       (SELECT COUNT(*) FROM customers)  AS customers,
       (SELECT COUNT(*) FROM users)      AS users_left,
       (SELECT GROUP_CONCAT(email) FROM users) AS logins_left,
       (SELECT COUNT(*) FROM plans WHERE deleted_at IS NULL) AS plans;
