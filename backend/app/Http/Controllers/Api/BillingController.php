<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillingPayment;
use App\Models\Plan;
use App\Services\BillingService;
use App\Support\CurrentCompany;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Plan & payment screen of a company. Reachable even after the plan has expired
 * (EnsureCompanyAccess lets billing.* routes through), so the company can pay to continue.
 */
class BillingController extends Controller
{
    public function __construct(private BillingService $billing) {}

    public function index()
    {
        $company = CurrentCompany::get();
        $renewing = $this->billing->renewing($company->id);

        return response()->json([
            'enabled' => $this->billing->enabled(),
            'company' => [
                'plan' => $company->plan,
                'plan_id' => $company->plan_id,
                'expires_at' => $company->expires_at?->toDateString(),
                'expired' => $company->isExpired(),
            ],
            'auto_renew' => $renewing ? ['plan_id' => $renewing->plan_id, 'plan' => $renewing->plan?->name] : null,
            'plans' => Plan::where('is_active', true)->orderBy('sort_order')->orderBy('price')->get()
                ->map(fn (Plan $p) => $p->only('id', 'name', 'name_mr', 'price', 'interval', 'description')),
            'payments' => BillingPayment::with('plan:id,name,name_mr')->latest('id')->limit(24)->get()
                ->map(fn (BillingPayment $p) => [
                    'id' => $p->id,
                    'date' => $p->created_at->toDateString(),
                    'plan' => $p->plan?->name,
                    'amount' => $p->amount,
                    'period_end' => $p->period_end?->toDateString(),
                ]),
        ]);
    }

    public function subscribe(Request $request)
    {
        $data = $request->validate(['plan_id' => ['required', 'integer', Rule::exists('plans', 'id')->where('is_active', true)->whereNull('deleted_at')]]);

        return response()->json($this->billing->subscribe(Plan::findOrFail($data['plan_id']), $request->user()));
    }

    public function verify(Request $request)
    {
        $data = $request->validate([
            'razorpay_payment_id' => ['required', 'string', 'max:40'],
            'razorpay_subscription_id' => ['required', 'string', 'max:40'],
            'razorpay_signature' => ['required', 'string', 'max:200'],
        ]);
        $company = $this->billing->verify($data['razorpay_payment_id'], $data['razorpay_subscription_id'], $data['razorpay_signature']);

        return response()->json([
            'message' => __('पेमेंट यशस्वी! तुमचा प्लॅन :date पर्यंत सुरू आहे.', ['date' => $company->expires_at->format('d/m/Y')]),
            'expires_at' => $company->expires_at->toDateString(),
        ]);
    }

    public function cancel()
    {
        $this->billing->cancel();

        return response()->json(['message' => __('ऑटो-रिन्यू बंद केले. प्लॅन शेवटच्या तारखेपर्यंत सुरू राहील.')]);
    }

    /** Razorpay → us (no login). Wrong signature = 400 so a forged call does nothing. */
    public function webhook(Request $request)
    {
        $ok = $this->billing->webhook($request->getContent(), $request->header('X-Razorpay-Signature'));

        return response()->json(['ok' => $ok], $ok ? 200 : 400);
    }
}
