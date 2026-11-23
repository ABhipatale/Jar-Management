<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\InvoiceRequest;
use App\Services\InvoiceService;

class InvoiceController extends Controller
{
    public function __construct(private InvoiceService $invoices) {}

    /** The invoice number a bill has or will get (nothing is reserved). Shown while the bill is previewed. */
    public function peek(InvoiceRequest $request)
    {
        return response()->json($this->invoices->peek($this->invoices->keyFor($request->validated())));
    }

    /** Reserve (or return the existing) invoice number. Called when the bill is sent, saved as PDF or printed. */
    public function store(InvoiceRequest $request)
    {
        $d = $request->validated();
        $invoice = $this->invoices->issue($this->invoices->keyFor($d), $d['customer_id'] ?? null, $d['from'] ?? null, $d['to'] ?? null);

        return response()->json(['number' => $invoice->number, 'issued' => true]);
    }
}
