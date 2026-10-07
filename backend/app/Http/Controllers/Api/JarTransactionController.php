<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\JarTransactionRequest;
use App\Http\Requests\UpdateJarTransactionRequest;
use App\Models\JarTransaction;
use App\Services\JarTransactionService;
use Illuminate\Http\Request;

class JarTransactionController extends Controller
{
    public function __construct(private JarTransactionService $service) {}

    /** ?from ?to ?customer_id ?type=given|returned ?search (customer name/mobile) */
    public function index(Request $request)
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'customer_id' => ['nullable', 'integer'],
            'type' => ['nullable', 'in:given,returned'],
        ]);

        $search = trim((string) $request->input('search'));

        $page = JarTransaction::with('customer:id,name,mobile')
            ->when($request->input('from'), fn ($q, $v) => $q->where('transaction_date', '>=', $v))
            ->when($request->input('to'), fn ($q, $v) => $q->where('transaction_date', '<=', $v))
            ->when($request->input('customer_id'), fn ($q, $v) => $q->where('customer_id', $v))
            ->when($request->input('type'), fn ($q, $v) => $q->where('transaction_type', $v))
            ->when($search !== '', fn ($q) => $q->whereHas('customer', fn ($c) => $c
                ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($search).'%'])
                ->orWhere('mobile', 'like', '%'.$search.'%')))
            ->orderByDesc('transaction_date')->orderByDesc('id')
            ->paginate(30);

        $page->getCollection()->transform(fn ($t) => $this->present($t));

        return $page;
    }

    public function store(JarTransactionRequest $request)
    {
        [$tx, $created, $balance, $returned] = $this->service->create($request->validated(), $request->user()?->id);
        $tx->load('customer:id,name,mobile');

        return response()->json([
            'message' => __('जार नोंद यशस्वीरित्या जतन झाली.'),
            'duplicate' => ! $created,
            'data' => $this->present($tx) + [
                'current_jars' => $balance['current_jars'],
                'pending_amount' => $balance['pending'],
                'returned_quantity' => $returned,
            ],
        ], $created ? 201 : 200);
    }

    public function show(JarTransaction $jarTransaction)
    {
        return response()->json(['data' => $this->present($jarTransaction->load('customer:id,name,mobile'))]);
    }

    public function update(UpdateJarTransactionRequest $request, JarTransaction $jarTransaction)
    {
        [$tx, $balance] = $this->service->update($jarTransaction, $request->validated());
        $tx->load('customer:id,name,mobile');

        return response()->json([
            'message' => __('नोंद बदलली.'),
            'data' => $this->present($tx) + [
                'current_jars' => $balance['current_jars'],
                'pending_amount' => $balance['pending'],
            ],
        ]);
    }

    public function destroy(JarTransaction $jarTransaction)
    {
        $this->service->delete($jarTransaction);

        return response()->json(['message' => __('नोंद हटवली.')]);
    }

    private function present(JarTransaction $t): array
    {
        return [
            'id' => $t->id,
            'customer_id' => $t->customer_id,
            'customer_name' => $t->customer?->name,
            'customer_mobile' => $t->customer?->mobile,
            'transaction_date' => $t->transaction_date->toDateString(),
            'transaction_type' => $t->transaction_type,
            'jar_quantity' => $t->jar_quantity,
            'payment_type' => $t->payment_type,
            'rate' => $t->rate,
            'amount' => $t->amount,
            'paid_amount' => $t->paid_amount,
            'udhari_amount' => $t->udhari_amount,
            'advance_amount' => $t->advance_amount,
            'notes' => $t->notes,
        ];
    }
}
