<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Base request: the API is single-admin, so any logged-in user is authorised. */
abstract class ApiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** "+91 98765-43210" → "9876543210" */
    protected function cleanMobile(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return $value;
        }
        $digits = preg_replace('/\D/', '', $value);
        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            $digits = substr($digits, 2);
        } elseif (strlen($digits) === 11 && str_starts_with($digits, '0')) {
            $digits = substr($digits, 1);
        }

        return $digits;
    }
}
