<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One action taken by the super admin (create, suspend, impersonate…). */
class AdminAuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'company_id', 'action', 'meta'];

    protected function casts(): array
    {
        return ['meta' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class)->withTrashed();
    }
}
