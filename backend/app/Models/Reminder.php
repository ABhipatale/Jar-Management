<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reminder extends Model
{
    public const DAYS = [1, 7, 15];

    protected $fillable = [
        'customer_id', 'jar_transaction_id', 'days', 'remind_on', 'status', 'auto_done',
        'pushed_at', 'read_at', 'done_at',
    ];

    protected function casts(): array
    {
        return [
            'remind_on' => 'date:Y-m-d',
            'days' => 'integer',
            'auto_done' => 'boolean',
            'pushed_at' => 'datetime',
            'read_at' => 'datetime',
            'done_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function jarTransaction(): BelongsTo
    {
        return $this->belongsTo(JarTransaction::class);
    }
}
