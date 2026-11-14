<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One successful plan payment (adds one month or year to the company's plan). */
class BillingPayment extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'billing_order_id', 'plan_id', 'razorpay_payment_id', 'amount', 'currency', 'mode', 'method', 'note', 'period_end'];

    protected function casts(): array
    {
        return ['amount' => 'float', 'period_end' => 'datetime'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class)->withTrashed();
    }
}
