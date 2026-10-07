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
            'pending_amount' => round((float) ($r->pending_amount ?? 0), 2),
            'last_payment_date' => isset($r->last_payment_date) ? substr((string) $r->last_payment_date, 0, 10) : null,
            'created_at' => $r->created_at ? substr((string) $r->created_at, 0, 10) : null,
        ];
    }
}
