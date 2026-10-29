<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** A business (tenant) using the app. */
class Company extends Model
{
    use HasFactory, SoftDeletes;

    public const ACTIVE = 'active';
    public const SUSPENDED = 'suspended';

    /** Same defaults as the database, so a freshly created model has them too. */
    protected $attributes = [
        'status' => self::ACTIVE,
        'locale' => 'mr',
        'assets_version' => 0,
        'bottles_enabled' => false,
        'deposit_enabled' => false,
    ];

    protected $fillable = [
        'name', 'name_mr', 'short_name', 'slug', 'locale',
        'status', 'plan', 'plan_id', 'expires_at', 'assets_version',
        'bottles_enabled', 'deposit_enabled',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'assets_version' => 'integer',
            'bottles_enabled' => 'boolean',
            'deposit_enabled' => 'boolean',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function currentPlan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id')->withTrashed();
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /**
     * Registered with "payment pending": its plan "ended" the moment it was created, so its users
     * see only the plans screen (with a welcome text) until the first payment.
     */
    public function awaitingFirstPayment(): bool
    {
        return $this->isExpired() && $this->created_at !== null
            && $this->expires_at->lte($this->created_at->copy()->addMinute());
    }

    /** Can its users log in and use the app right now? */
    public function isUsable(): bool
    {
        return $this->status === self::ACTIVE && ! $this->isExpired() && ! $this->trashed();
    }
}
