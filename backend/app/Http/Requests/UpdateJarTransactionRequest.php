<?php

namespace App\Http\Requests;

/** Editing a jar entry: same rules/messages as a new one, minus customer/type (fixed). */
class UpdateJarTransactionRequest extends JarTransactionRequest
{
    public function rules(): array
    {
        return array_intersect_key(parent::rules(), array_flip([
            'transaction_date', 'payment_type', 'rate', 'paid_amount', 'advance_amount', 'deposit_amount', 'notes',
        ])) + ['jar_quantity' => ['required', 'integer', 'min:1', 'max:10000']];
    }
}
