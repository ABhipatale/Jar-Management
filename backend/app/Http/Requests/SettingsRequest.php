<?php

namespace App\Http\Requests;

class SettingsRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('business_mobile')) {
            $this->merge(['business_mobile' => $this->cleanMobile($this->input('business_mobile'))]);
        }
    }

    public function rules(): array
    {
        return [
            'business_name' => ['sometimes', 'required', 'string', 'max:120'],
            'business_name_mr' => ['sometimes', 'nullable', 'string', 'max:120'],
            'short_name' => ['sometimes', 'nullable', 'string', 'max:40'],
            'business_address' => ['sometimes', 'nullable', 'string', 'max:300'],
            'business_place_mr' => ['sometimes', 'nullable', 'string', 'max:120'],
            'business_mobile' => ['sometimes', 'nullable', 'regex:/^[6-9][0-9]{9}$/'],
            'owner_name_mr' => ['sometimes', 'nullable', 'string', 'max:120'],
            'contact_numbers' => ['sometimes', 'nullable', 'string', 'max:200'],
            'default_rate' => ['sometimes', 'numeric', 'min:0', 'max:100000'],
            'jar_tracking' => ['sometimes', 'boolean'],
            'total_jars' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'expense_types' => ['sometimes', 'nullable', 'string', 'max:500'],
            'wa_delivery' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'wa_return' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'wa_payment' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'wa_reminder' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'wa_summary' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'business_name.required' => __('कृपया व्यवसायाचे नाव टाका.'),
            'business_mobile.regex' => __('कृपया योग्य 10 अंकी मोबाईल नंबर टाका.'),
            'total_jars.min' => __('एकूण जार उणे असू शकत नाहीत.'),
            'default_rate.min' => __('दर उणे असू शकत नाही.'),
        ];
    }
}
