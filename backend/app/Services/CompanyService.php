<?php

namespace App\Services;

use App\Models\Company;
use App\Models\User;
use App\Support\CurrentCompany;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Creating a business: the company, its owner login and its default settings — all or nothing. */
class CompanyService
{
    public function __construct(private SettingService $settings) {}

    /**
     * @param  array{name:string, name_mr?:?string, short_name?:?string, slug?:?string, plan?:?string,
     *               expires_at?:mixed, locale?:?string, owner_name:string, owner_email:string,
     *               owner_mobile?:?string, owner_password:string}  $data
     */
    public function create(array $data): Company
    {
        return DB::transaction(function () use ($data) {
            $company = Company::create([
                'name' => $data['name'],
                'name_mr' => $data['name_mr'] ?? null,
                'short_name' => $data['short_name'] ?? null,
                'slug' => $this->uniqueSlug($data['slug'] ?? null ?: $data['name']),
                'locale' => $data['locale'] ?? 'mr',
                'plan' => $data['plan'] ?? null,
                'plan_id' => $data['plan_id'] ?? null,
                'expires_at' => $data['expires_at'] ?? null,
                'status' => Company::ACTIVE,
            ]);

            User::create([
                'company_id' => $company->id,
                'role' => User::OWNER,
                'name' => $data['owner_name'],
                'email' => mb_strtolower($data['owner_email']),
                'mobile' => $data['owner_mobile'] ?? null,
                'password' => $data['owner_password'],
            ]);

            $this->ensureDefaultSettings($company);

            return $company;
        });
    }

    /** Store default settings once; never overwrite what the owner already changed. */
    public function ensureDefaultSettings(Company $company): void
    {
        CurrentCompany::run($company, function () {
            $existing = \App\Models\Setting::pluck('key')->all();
            $this->settings->save(array_diff_key(SettingService::DEFAULTS, array_flip($existing)));
        });
    }

    public function uniqueSlug(string $source, ?int $ignoreId = null): string
    {
        $base = Str::slug($source) ?: 'company';
        $base = Str::limit($base, 50, '');
        $slug = $base;
        for ($i = 2; Company::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists(); $i++) {
            $slug = $base.'-'.$i;
        }

        return $slug;
    }
}
