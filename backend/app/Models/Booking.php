<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    protected $fillable = [
        'customer_id', 'delivery_date', 'jar_quantity', 'notes', 'status', 'jar_transaction_id',
        'eve_notified_at', 'morning_notified_at', 'delivered_at',
    ];

    protected function casts(): array
    {
        return [
            'delivery_date' => 'date:Y-m-d',
            'jar_quantity' => 'integer',
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
