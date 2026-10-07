<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A company's Razorpay subscription (auto-renewing plan payment). */
class Subscription extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'plan_id', 'user_id', 'razorpay_subscription_id', 'status', 'cancel_at_period_end'];

    protected function casts(): array
    {
        return ['cancel_at_period_end' => 'boolean'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class)->withTrashed();
    }

    /** Paid and will renew by itself. */
    public function renews(): bool
    {
        return $this->status === 'active' && ! $this->cancel_at_period_end;
    }
}
