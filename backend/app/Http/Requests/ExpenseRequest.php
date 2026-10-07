<?php

namespace App\Http\Requests;

class ExpenseRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'expense_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'expense_type' => ['required', 'string', 'max:60'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:10000000'],
            'payment_mode' => ['required', 'in:cash,upi,bank'],
            'notes' => ['nullable', 'string', 'max:500'],
            'client_uuid' => ['nullable', 'uuid'],
        ];
    }

    public function messages(): array
    {
        return [
            'expense_type.required' => __('कृपया खर्चाचा प्रकार टाका.'),
            'amount.required' => __('कृपया रक्कम टाका.'),
            'amount.gt' => __('रक्कम शून्यापेक्षा जास्त असावी.'),
            'payment_mode.in' => __('चुकीची पेमेंट पद्धत.'),
            'expense_date.before_or_equal' => __('दिनांक भविष्यातील असू शकत नाही.'),
        ];
    }
}
