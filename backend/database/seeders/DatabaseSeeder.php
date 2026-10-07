<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\SettingService;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Production seed: the single admin account + default shop settings.
     * Admin credentials come from .env (ADMIN_EMAIL / ADMIN_MOBILE / ADMIN_PASSWORD).
     */
    public function run(): void
    {
        // firstOrCreate: re-running the seeder never resets a password changed in the app.
        User::firstOrCreate(
            ['email' => mb_strtolower(config('shop.admin.email'))],
            [
                'name' => config('shop.admin.name'),
                'mobile' => config('shop.admin.mobile') ?: null,
                'password' => config('shop.admin.password'),
            ]
        );

        // Store defaults once; never overwrite what the owner already changed.
        $settings = app(SettingService::class);
        $existing = \App\Models\Setting::pluck('key')->all();
        $settings->save(array_diff_key(SettingService::DEFAULTS, array_flip($existing)));
    }
}
