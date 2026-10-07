<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PaymentRequest;
use App\Http\Requests\UpdatePaymentRequest;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(private PaymentService $service) {}

    public function index(Request $request)
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'customer_id' => ['nullable', 'integer'],
            'mode' => ['nullable', 'in:cash,upi,bank'],
        ]);

        $search = trim((string) $request->input('search'));

        $page = Payment::with('customer:id,name,mobile')
            ->when($request->input('from'), fn ($q, $v) => $q->where('payment_date', '>=', $v))
            ->when($request->input('to'), fn ($q, $v) => $q->where('payment_date', '<=', $v))
            ->when($request->input('customer_id'), fn ($q, $v) => $q->where('customer_id', $v))
            ->when($request->input('mode'), fn ($q, $v) => $q->where('payment_mode', $v))
            ->when($search !== '', fn ($q) => $q->whereHas('customer', fn ($c) => $c
                ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($search).'%'])
                ->orWhere('mobile', 'like', '%'.$search.'%')))
            ->orderByDesc('payment_date')->orderByDesc('id')
            ->paginate(30);

        $page->getCollection()->transform(fn ($p) => $this->present($p));

        return $page;
    }

    public function store(PaymentRequest $request)
    {
        [$payment, $created] = $this->service->create($request->validated(), $request->user()?->id);
        $payment->load('customer:id,name,mobile');

        return response()->json([
            'message' => __('पेमेंट यशस्वीरित्या मिळाले.'),
            'duplicate' => ! $created,
            'data' => $this->present($payment),
        ], $created ? 201 : 200);
    }

    public function show(Payment $payment)
    {
        return response()->json(['data' => $this->present($payment->load('customer:id,name,mobile'))]);
    }

    public function update(UpdatePaymentRequest $request, Payment $payment)
    {
        $payment = $this->service->update($payment, $request->validated());
        $payment->load('customer:id,name,mobile');

        return response()->json(['message' => __('पेमेंट बदलले.'), 'data' => $this->present($payment)]);
    }

    public function destroy(Payment $payment)
    {
        $this->service->delete($payment);

        return response()->json(['message' => __('पेमेंट हटवले.')]);
    }

    private function present(Payment $p): array
    {
        return [
            'id' => $p->id,
            'customer_id' => $p->customer_id,
            'customer_name' => $p->customer?->name,
            'customer_mobile' => $p->customer?->mobile,
            'payment_date' => $p->payment_date->toDateString(),
            'amount' => $p->amount,
            'payment_mode' => $p->payment_mode,
            'previous_pending' => $p->previous_pending,
            'remaining_pending' => $p->remaining_pending,
            'is_advance' => $p->is_advance,
            'notes' => $p->notes,
        ];
    }
}
