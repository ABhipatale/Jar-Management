<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class JarTransaction extends Model
{
    use BelongsToCompany, SoftDeletes;

    public const GIVEN = 'given';
    public const RETURNED = 'returned';

    protected $fillable = [
        'customer_id', 'transaction_date', 'transaction_type', 'jar_quantity', 'payment_type',
        'rate', 'amount', 'paid_amount', 'udhari_amount', 'advance_amount', 'notes',
        'client_uuid', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date:Y-m-d',
            'jar_quantity' => 'integer',
            'rate' => 'float',
            'amount' => 'float',
            'paid_amount' => 'float',
            'udhari_amount' => 'float',
            'advance_amount' => 'float',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }
}
