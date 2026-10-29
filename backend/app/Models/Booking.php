<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    use BelongsToCompany;

    /** Same default as the database, so a freshly created model has it too. */
    protected $attributes = ['bottle_quantity' => 0];

    protected $fillable = [
        'customer_id', 'delivery_date', 'jar_quantity', 'bottle_quantity', 'notes', 'status', 'jar_transaction_id',
        'eve_notified_at', 'morning_notified_at', 'delivered_at',
    ];

    protected function casts(): array
    {
        return [
            'delivery_date' => 'date:Y-m-d',
            'jar_quantity' => 'integer',
            'bottle_quantity' => 'integer',
            'eve_notified_at' => 'datetime',
            'morning_notified_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }
}
