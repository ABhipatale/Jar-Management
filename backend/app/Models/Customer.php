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
    protected $attributes = ['takes_jar' => true, 'takes_bottle' => false, 'no_deposit' => false, 'opening_balance' => 0];

    protected $fillable = [
        'name', 'mobile', 'address', 'status',
        'takes_jar', 'takes_bottle', 'jar_rate', 'bottle_rate', 'no_deposit', 'opening_balance',
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
