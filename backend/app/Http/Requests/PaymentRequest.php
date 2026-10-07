<?php

namespace App\Http\Requests;

use App\Support\CurrentCompany;
use Illuminate\Validation\Rule;

class PaymentRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->where('company_id', CurrentCompany::id())->whereNull('deleted_at')],
            'payment_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:10000000'],
            'payment_mode' => ['required', 'in:cash,upi,bank'],
            'is_advance' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
            'client_uuid' => ['nullable', 'uuid'],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_id.required' => __('कृपया ग्राहक निवडा.'),
            'customer_id.exists' => __('कृपया योग्य ग्राहक निवडा.'),
            'payment_date.before_or_equal' => __('दिनांक भविष्यातील असू शकत नाही.'),
            'amount.required' => __('कृपया भरलेली रक्कम टाका.'),
            'amount.numeric' => __('कृपया योग्य रक्कम टाका.'),
            'amount.gt' => __('पेमेंटची रक्कम शून्यापेक्षा जास्त असावी.'),
            'payment_mode.required' => __('कृपया पेमेंट पद्धत निवडा.'),
            'payment_mode.in' => __('चुकीची पेमेंट पद्धत.'),
        ];
    }
}
