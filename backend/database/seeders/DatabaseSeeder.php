<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\User;
use App\Services\CompanyService;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Production seed, safe to re-run:
     *  - the platform super admin (SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD in .env);
     *  - default settings for every company that is missing some.
     * Companies and their owners are created from the super-admin panel.
     */
    public function run(): void
    {
        $email = config('shop.superadmin.email');
        if ($email && config('shop.superadmin.password')) {
            // firstOrCreate: re-running the seeder never resets a password changed in the app.
            User::firstOrCreate(
                ['email' => mb_strtolower($email)],
                [
                    'name' => config('shop.superadmin.name'),
                    'password' => config('shop.superadmin.password'),
                    'role' => User::SUPER_ADMIN,
                    'company_id' => null,
                ]
            );
        }

        $companies = app(CompanyService::class);
        Company::all()->each(fn (Company $c) => $companies->ensureDefaultSettings($c));
    }
}
