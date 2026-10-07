<?php

namespace App\Models\Concerns;

use App\Models\Company;
use App\Support\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Every query on the model only sees the current company's rows, and new rows get the
 * current company's id. With no company context the query matches nothing.
 *
 * Query-builder code (DB::table) bypasses this — those queries add company_id themselves.
 */
trait BelongsToCompany
{
    public static function bootBelongsToCompany(): void
    {
        static::addGlobalScope('company', function (Builder $query) {
            $id = CurrentCompany::id();
            $id
                ? $query->where($query->qualifyColumn('company_id'), $id)
                : $query->whereRaw('1 = 0');
        });

        static::creating(function ($model) {
            $model->company_id ??= CurrentCompany::require();
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
