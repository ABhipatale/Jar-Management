<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ExpenseRequest;
use App\Models\Expense;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);
        $search = trim((string) $request->input('search'));

        $q = Expense::query()
            ->when($request->input('from'), fn ($q, $v) => $q->where('expense_date', '>=', $v))
            ->when($request->input('to'), fn ($q, $v) => $q->where('expense_date', '<=', $v))
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->whereRaw('LOWER(expense_type) LIKE ?', ['%'.mb_strtolower($search).'%'])
                ->orWhereRaw('LOWER(notes) LIKE ?', ['%'.mb_strtolower($search).'%'])));

        return response()->json([
            'total' => round((float) (clone $q)->sum('amount'), 2),
            'data' => $q->orderByDesc('expense_date')->orderByDesc('id')->limit(500)->get()
                ->map(fn ($e) => $e->only('id', 'expense_type', 'amount', 'payment_mode', 'notes') + [
                    'expense_date' => $e->expense_date->toDateString(),
                ]),
        ]);
    }

    public function store(ExpenseRequest $request)
    {
        $data = $request->validated();
        if (! empty($data['client_uuid']) && $existing = Expense::where('client_uuid', $data['client_uuid'])->first()) {
            return response()->json(['message' => __('खर्च यशस्वीरित्या जतन झाला.'), 'data' => $existing]);
        }
        $expense = Expense::create($data);

        return response()->json(['message' => __('खर्च यशस्वीरित्या जतन झाला.'), 'data' => $expense], 201);
    }

    public function destroy(Expense $expense)
    {
        $expense->delete();

        return response()->json(['message' => __('खर्च हटवला.')]);
    }
}
