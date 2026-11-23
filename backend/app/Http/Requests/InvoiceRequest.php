<?php

namespace App\Http\Requests;

use App\Support\CurrentCompany;
use Illuminate\Validation\Rule;

/** A customer bill (customer_id + period) or a manual bill (draft_id + customer name / mobile). */
class InvoiceRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where('company_id', CurrentCompany::id())],
            'from' => ['required_with:customer_id', 'date_format:Y-m-d'],
            'to' => ['required_with:customer_id', 'date_format:Y-m-d', 'after_or_equal:from'],
            'draft_id' => ['required_without:customer_id', 'string', 'min:8', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
            'name' => ['nullable', 'string', 'max:120'],
            'mobile' => ['nullable', 'string', 'max:20'],
        ];
    }
}
