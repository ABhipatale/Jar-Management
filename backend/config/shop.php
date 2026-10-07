<?php

// Read through config() so values still work after `php artisan config:cache`.
return [
    // The platform owner who registers and manages companies (created by: php artisan db:seed).
    'superadmin' => [
        'name' => env('SUPERADMIN_NAME', 'Super Admin'),
        'email' => env('SUPERADMIN_EMAIL'),
        'password' => env('SUPERADMIN_PASSWORD'),
    ],

    // Shown where no company is known yet (login page, super-admin panel).
    'platform_name' => env('PLATFORM_NAME', 'Jar Management'),
    'platform_name_mr' => env('PLATFORM_NAME_MR', 'जार व्यवस्थापन'),

    // Web Push keys for phone notifications (reminders). Generate once; keep the private key secret.
    'vapid' => [
        'public' => env('VAPID_PUBLIC_KEY'),
        'private' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT', 'mailto:admin@example.com'),
    ],

];
