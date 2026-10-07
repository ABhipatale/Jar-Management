<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class JarTransactionRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'transaction_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'transaction_type' => ['required', 'in:given,returned'],
            'jar_quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            // GIVE only: empty jars taken back at the same delivery (saved as a RETURN entry).
            'return_quantity' => ['nullable', 'integer', 'min:0', 'max:10000'],
            // GIVE only: follow-up reminder after 1, 7 or 15 days (0/empty = none).
            'reminder_days' => ['nullable', 'integer', 'in:0,1,7,15'],
            // GIVE only: this delivery fulfils an advance booking.
            'booking_id' => ['nullable', 'integer'],
            'payment_type' => ['nullable', 'in:cash,udhari'],
            'rate' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'paid_amount' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'advance_amount' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'notes' => ['nullable', 'string', 'max:500'],
            'client_uuid' => ['nullable', 'uuid'],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_id.required' => __('कृपया ग्राहक निवडा.'),
            'customer_id.exists' => __('कृपया योग्य ग्राहक निवडा.'),
            'transaction_date.required' => __('कृपया दिनांक निवडा.'),
            'transaction_date.before_or_equal' => __('दिनांक भविष्यातील असू शकत नाही.'),
            'transaction_type.required' => __('कृपया जार दिले किंवा जार परत निवडा.'),
            'transaction_type.in' => __('चुकीचा व्यवहार प्रकार.'),
            'jar_quantity.required' => __('कृपया जारची संख्या टाका.'),
            'jar_quantity.integer' => __('जारची संख्या पूर्ण अंकात असावी.'),
            'jar_quantity.min' => __('जारची संख्या किमान 1 असावी.'),
            'payment_type.in' => __('चुकीचा पेमेंट प्रकार.'),
            'rate.min' => __('दर उणे असू शकत नाही.'),
            'paid_amount.min' => __('भरलेली रक्कम उणे असू शकत नाही.'),
            'advance_amount.min' => __('आगाऊ रक्कम उणे असू शकत नाही.'),
        ];
    }
}
