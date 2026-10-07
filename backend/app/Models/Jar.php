<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Jar extends Model
{
    public const STATUSES = ['available', 'with_customer', 'returned', 'damaged', 'lost'];

    protected $fillable = ['jar_number', 'status', 'customer_id', 'status_date'];

    protected function casts(): array
    {
        return ['status_date' => 'date:Y-m-d'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }
}
