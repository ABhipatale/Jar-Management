<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Works for a BalanceService row (stdClass) or an Eloquent Customer with balances attached. */
class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $r = $this->resource;

        return [
            'id' => (int) $r->id,
            'name' => $r->name,
            'mobile' => $r->mobile,
            'address' => $r->address,
            'status' => $r->status,
            'current_jars' => (int) ($r->current_jars ?? 0),
            'current_bottles' => (int) ($r->current_bottles ?? 0),
            'pending_amount' => round((float) ($r->pending_amount ?? 0), 2),
            // Refundable deposit held, per product and in total (never part of pending).
            'jar_deposit_held' => round((float) ($r->jar_deposit_held ?? 0), 2),
            'bottle_deposit_held' => round((float) ($r->bottle_deposit_held ?? 0), 2),
            'deposit_held' => round((float) ($r->deposit_held ?? 0), 2),
            'takes_jar' => (bool) ($r->takes_jar ?? true),
            'takes_bottle' => (bool) ($r->takes_bottle ?? false),
            // Special price for this customer; null = the shop's default rate.
            'jar_rate' => isset($r->jar_rate) ? (float) $r->jar_rate : null,
            'bottle_rate' => isset($r->bottle_rate) ? (float) $r->bottle_rate : null,
            'no_deposit' => (bool) ($r->no_deposit ?? false),
            'last_payment_date' => isset($r->last_payment_date) ? substr((string) $r->last_payment_date, 0, 10) : null,
            'created_at' => $r->created_at ? substr((string) $r->created_at, 0, 10) : null,
        ];
    }
}
