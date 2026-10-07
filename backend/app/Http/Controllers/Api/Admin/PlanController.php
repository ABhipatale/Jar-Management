<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Plan;
use App\Services\BillingService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Super admin: the plans companies can buy. */
class PlanController extends Controller
{
    public function index(BillingService $billing)
    {
        $counts = Company::whereNotNull('plan_id')->groupBy('plan_id')->selectRaw('plan_id, COUNT(*) AS n')->pluck('n', 'plan_id');

        return response()->json([
            'payments_enabled' => $billing->enabled(),
            'data' => Plan::orderBy('sort_order')->orderBy('price')->get()->map(fn (Plan $p) => $p->only(
                'id', 'name', 'name_mr', 'price', 'interval', 'description', 'is_active', 'sort_order'
            ) + ['companies' => (int) ($counts[$p->id] ?? 0)]),
        ]);
    }

    public function store(Request $request)
    {
        $plan = Plan::create($request->validate($this->rules()));

        return response()->json(['message' => __('प्लॅन जोडला.'), 'data' => $plan], 201);
    }

    public function update(Request $request, Plan $plan)
    {
        $plan->fill($request->validate($this->rules(true)));
        // Razorpay plans cannot change: a new one is created on the next purchase.
        // (Subscriptions already running keep renewing at their old price.)
        if ($plan->isDirty(['price', 'interval'])) {
            $plan->razorpay_plan_id = null;
        }
        $plan->save();

        return response()->json(['message' => __('प्लॅन बदलला.'), 'data' => $plan]);
    }

    public function destroy(Plan $plan)
    {
        // Soft delete: companies already on it and running subscriptions keep working.
        $plan->delete();

        return response()->json(['message' => __('प्लॅन हटवला.')]);
    }

    private function rules(bool $update = false): array
    {
        $req = $update ? 'sometimes' : 'required';

        return [
            'name' => [$req, 'string', 'max:60'],
            'name_mr' => ['sometimes', 'nullable', 'string', 'max:60'],
            'price' => [$req, 'numeric', 'min:1', 'max:1000000'],
            'interval' => [$req, Rule::in(['month', 'year'])],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:1000'],
        ];
    }
}
