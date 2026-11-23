<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

/** An issued invoice number. Never edited or deleted: numbers are never reused. */
class Invoice extends Model
{
    use BelongsToCompany;

    protected $fillable = ['customer_id', 'year', 'seq', 'number', 'key', 'period_from', 'period_to'];

    protected function casts(): array
    {
        return ['year' => 'integer', 'seq' => 'integer', 'period_from' => 'date:Y-m-d', 'period_to' => 'date:Y-m-d'];
    }
}
