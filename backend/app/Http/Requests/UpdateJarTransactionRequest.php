<?php

namespace App\Http\Requests;

/** Editing a jar entry: same rules/messages as a new one, minus customer/type (fixed). */
class UpdateJarTransactionRequest extends JarTransactionRequest
{
    public function rules(): array
    {
        return array_intersect_key(parent::rules(), array_flip([
            'transaction_date', 'jar_quantity', 'payment_type', 'rate', 'paid_amount', 'advance_amount', 'notes',
        ]));
    }
}
