<?php

namespace App\Http\Requests;

/** Editing a payment: same rules/messages as a new one, minus customer (fixed). */
class UpdatePaymentRequest extends PaymentRequest
{
    public function rules(): array
    {
        return array_intersect_key(parent::rules(), array_flip([
            'payment_date', 'amount', 'payment_mode', 'is_advance', 'notes',
        ]));
    }
}
