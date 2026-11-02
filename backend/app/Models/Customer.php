<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use BelongsToCompany, SoftDeletes;

    /** Same defaults as the database, so a freshly created model has them too. */
    protected $attributes = ['takes_jar' => true, 'takes_bottle' => false, 'no_deposit' => false, 'opening_balance' => 0, 'opening_jars' => 0, 'opening_bottles' => 0,
        'route_morning' => false, 'route_evening' => false, 'morning_qty' => 1, 'evening_qty' => 1,
        'schedule_type' => 'daily', 'schedule_every' => 2,
    ];

    protected $fillable = [
        'name', 'mobile', 'address', 'status',
        'takes_jar', 'takes_bottle', 'jar_rate', 'bottle_rate', 'no_deposit', 'opening_balance', 'opening_jars', 'opening_bottles',
        // Daily delivery route (only used when the company has routes switched on).
        'route_morning', 'route_evening', 'morning_qty', 'evening_qty', 'schedule_type', 'schedule_every',
        'schedule_days', 'morning_order', 'evening_order', 'delivery_note',
    ];

    protected function casts(): array
    {
        return [
            'takes_jar' => 'boolean',
            'takes_bottle' => 'boolean',
            'jar_rate' => 'float',
            'bottle_rate' => 'float',
            'no_deposit' => 'boolean',
            'opening_balance' => 'float',
            'opening_jars' => 'integer',
            'opening_bottles' => 'integer',
            'route_morning' => 'boolean',
            'route_evening' => 'boolean',
            'morning_qty' => 'integer',
            'evening_qty' => 'integer',
            'schedule_every' => 'integer',
            'morning_order' => 'integer',
            'evening_order' => 'integer',
        ];
    }

    public function jarTransactions(): HasMany
    {
        return $this->hasMany(JarTransaction::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function ledger(): HasMany
    {
        return $this->hasMany(CustomerLedger::class);
    }
}
