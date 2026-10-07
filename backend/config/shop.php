<?php

// Read through config() so values still work after `php artisan config:cache`.
return [
    'admin' => [
        'name' => env('ADMIN_NAME', 'Shop Owner'),
        'email' => env('ADMIN_EMAIL', 'admin@saiwater.in'),
        'mobile' => env('ADMIN_MOBILE'),
        'password' => env('ADMIN_PASSWORD', 'ChangeMe@123'),
    ],

    // Web Push keys for phone notifications (reminders). Generate once; keep the private key secret.
    'vapid' => [
        'public' => env('VAPID_PUBLIC_KEY'),
        'private' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT', 'mailto:admin@saiwater.in'),
    ],

];
