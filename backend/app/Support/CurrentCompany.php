<?php

namespace App\Support;

use App\Models\Company;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * The company (tenant) the current code is working for.
 *
 * Normally this is the logged-in user's company. Code that runs without a user
 * (the cron job, seeders, the super-admin panel) sets it explicitly with run().
 * Nothing ever takes the company from a request header or field.
 *
 * Fail-closed: with no company, tenant queries return nothing (see BelongsToCompany)
 * and require() throws, so data can never leak or be written to the wrong company.
 */
class CurrentCompany
{
    private bool $overridden = false;

    private ?int $override = null;

    private ?Company $cached = null;

    private static function instance(): self
    {
        return app(self::class);
    }

    public static function id(): ?int
    {
        $self = self::instance();
        if ($self->overridden) {
            return $self->override;
        }

        $user = Auth::guard('sanctum')->user() ?? Auth::user();

        return $user?->company_id ? (int) $user->company_id : null;
    }

    public static function require(): int
    {
        return self::id() ?? throw new RuntimeException('No company context.');
    }

    public static function get(): ?Company
    {
        $self = self::instance();
        $id = self::id();
        if (! $id) {
            return null;
        }
        if ($self->cached?->id !== $id) {
            $self->cached = Company::find($id);
        }

        return $self->cached;
    }

    /**
     * DB::table() limited to the current company — for query-builder code, which global
     * scopes do not reach. Accepts "table" or "table as alias".
     */
    public static function table(string $table): Builder
    {
        $alias = preg_match('/\s+as\s+(\w+)$/i', $table, $m) ? $m[1] : $table;

        return DB::table($table)->where("{$alias}.company_id", self::require());
    }

    /**
     * Run $fn as company $companyId (cron, seeders, super-admin actions), then restore.
     *
     * @template T
     *
     * @param  callable(): T  $fn
     * @return T
     */
    public static function run(int|Company $company, callable $fn): mixed
    {
        $self = self::instance();
        [$wasOverridden, $previous] = [$self->overridden, $self->override];
        $self->overridden = true;
        $self->override = $company instanceof Company ? $company->id : $company;

        try {
            return $fn();
        } finally {
            $self->overridden = $wasOverridden;
            $self->override = $previous;
        }
    }
}
