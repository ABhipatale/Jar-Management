<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerLedger extends Model
{
    protected $table = 'customer_ledger';

    protected $fillable = [
        'customer_id', 'entry_date', 'entry_type', 'jar_transaction_id', 'payment_id',
        'jars_given', 'jars_returned', 'amount', 'paid', 'udhari', 'balance', 'jar_balance',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date:Y-m-d',
            'jars_given' => 'integer',
            'jars_returned' => 'integer',
            'amount' => 'float',
            'paid' => 'float',
            'udhari' => 'float',
            'balance' => 'float',
            'jar_balance' => 'integer',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
