<?php

namespace App\Http\Requests;

class LoginRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'login' => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'max:120'],
            'remember' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'login.required' => __('कृपया ईमेल किंवा मोबाईल नंबर टाका.'),
            'password.required' => __('कृपया पासवर्ड टाका.'),
        ];
    }
}
