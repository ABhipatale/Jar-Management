<?php

// Read through config() so values still work after `php artisan config:cache`.
return [
    // The platform owner who registers and manages companies (created by: php artisan db:seed).
    'superadmin' => [
        'name' => env('SUPERADMIN_NAME', 'Super Admin'),
        'email' => env('SUPERADMIN_EMAIL'),
        'password' => env('SUPERADMIN_PASSWORD'),
    ],

    // The product name, shown where no company is known yet (login page, splash, super-admin panel).
    'platform_name' => env('PLATFORM_NAME', 'EasyJar'),
    'platform_name_mr' => env('PLATFORM_NAME_MR', 'EasyJar'),

    // Web Push keys for phone notifications (reminders). Generate once; keep the private key secret.
    'vapid' => [
        'public' => env('VAPID_PUBLIC_KEY'),
        'private' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT', 'mailto:admin@example.com'),
    ],

];
