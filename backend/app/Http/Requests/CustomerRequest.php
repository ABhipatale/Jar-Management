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
        ];
    }
}
