<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
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
    ];

    protected $fillable = [
        'name', 'name_mr', 'short_name', 'slug', 'locale',
        'status', 'plan', 'expires_at', 'assets_version',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'assets_version' => 'integer',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /** Can its users log in and use the app right now? */
    public function isUsable(): bool
    {
        return $this->status === self::ACTIVE && ! $this->isExpired() && ! $this->trashed();
    }
}
