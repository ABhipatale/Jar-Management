<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A Razorpay order: one one-time payment for one plan period (a month or a year). */
class BillingOrder extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'plan_id', 'user_id', 'razorpay_order_id', 'amount', 'status'];

    protected function casts(): array
    {
        return ['amount' => 'float'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class)->withTrashed();
    }
}
