<?php

namespace App\Http\Requests;

class CustomerRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) $this->input('name')),
            'mobile' => $this->cleanMobile($this->input('mobile')),
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'mobile' => ['required', 'regex:/^[6-9][0-9]{9}$/'],
            'address' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'in:active,inactive'],
            // Bottles / deposit (only used when the company has them switched on).
            'takes_jar' => ['sometimes', 'boolean'],
            'takes_bottle' => ['sometimes', 'boolean'],
            'jar_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100000'],
            'bottle_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100000'],
            'no_deposit' => ['sometimes', 'boolean'],
            // Old udhari from before the app (added to the pending amount).
            'opening_balance' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:10000000'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => __('कृपया ग्राहकाचे नाव टाका.'),
            'name.max' => __('ग्राहकाचे नाव खूप मोठे आहे.'),
            'mobile.required' => __('कृपया मोबाईल नंबर टाका.'),
            'mobile.regex' => __('कृपया योग्य 10 अंकी मोबाईल नंबर टाका.'),
            'status.in' => __('चुकीची ग्राहक स्थिती.'),
            'jar_rate.min' => __('दर उणे असू शकत नाही.'),
            'bottle_rate.min' => __('दर उणे असू शकत नाही.'),
            'opening_balance.min' => __('जुनी उधारी उणे असू शकत नाही.'),
        ];
    }
}
