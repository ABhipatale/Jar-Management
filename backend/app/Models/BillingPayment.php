<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One successful plan payment (first payment or an automatic renewal). */
class BillingPayment extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'subscription_id', 'plan_id', 'razorpay_payment_id', 'amount', 'currency', 'period_end'];

    protected function casts(): array
    {
        return ['amount' => 'float', 'period_end' => 'datetime'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class)->withTrashed();
    }
}
