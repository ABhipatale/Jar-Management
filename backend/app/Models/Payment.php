<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $fillable = [
        'customer_id', 'payment_date', 'amount', 'payment_mode', 'previous_pending',
        'remaining_pending', 'is_advance', 'notes', 'client_uuid', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date:Y-m-d',
            'amount' => 'float',
            'previous_pending' => 'float',
            'remaining_pending' => 'float',
            'is_advance' => 'boolean',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }
}
