<?php

namespace App\Services;

use App\Models\BillingPayment;
use App\Models\Company;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\CurrentCompany;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Plan payments with Razorpay Subscriptions (auto-renewing), via Razorpay's REST API.
 *
 *  1. subscribe(): creates (once) a Razorpay plan for our plan, then a subscription; the app
 *     opens Razorpay Checkout with its id.
 *  2. verify(): the app sends back the payment ids + signature; we check the signature and
 *     extend the company's plan.
 *  3. webhook(): Razorpay tells us about every automatic renewal (subscription.charged) and
 *     status changes; renewals extend the plan.
 *
 * Every payment is stored once (unique razorpay_payment_id), so the same payment arriving by
 * verify() AND the webhook — or the webhook being retried — extends the plan only once.
 */
class BillingService
{
    private const API = 'https://api.razorpay.com/v1';

    /** Billing cycles per subscription (Razorpay needs an end): ~10 years either way. */
    private const TOTAL_COUNT = ['month' => 120, 'year' => 10];

    public function enabled(): bool
    {
        return (bool) (config('services.razorpay.key_id') && config('services.razorpay.key_secret'));
    }

    private function api(): PendingRequest
    {
        return Http::withBasicAuth(config('services.razorpay.key_id'), config('services.razorpay.key_secret'))
            ->acceptJson()->asJson()->timeout(20);
    }

    private function call(string $method, string $path, array $data = []): array
    {
        $res = $this->api()->{$method}(self::API.$path, $data);
        if ($res->failed()) {
            Log::warning("Razorpay {$method} {$path} failed: ".$res->body());
            throw ValidationException::withMessages(['payment' => __('पेमेंट सुरू करता आले नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.')]);
        }

        return $res->json();
    }

    private function razorpayPlanId(Plan $plan): string
    {
        if (! $plan->razorpay_plan_id) {
            $rp = $this->call('post', '/plans', [
                'period' => $plan->interval === 'year' ? 'yearly' : 'monthly',
                'interval' => 1,
                'item' => [
                    'name' => $plan->name,
                    'amount' => (int) round($plan->price * 100),   // paise
                    'currency' => 'INR',
                ],
                'notes' => ['plan_id' => (string) $plan->id],
            ]);
            $plan->forceFill(['razorpay_plan_id' => $rp['id']])->save();
        }

        return $plan->razorpay_plan_id;
    }

    /** Start an auto-renewing subscription for the current company. Returns what Checkout needs. */
    public function subscribe(Plan $plan, User $user): array
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages(['payment' => __('ऑनलाइन पेमेंट लवकरच सुरू होईल. आत्ता प्लॅनसाठी कृपया सपोर्टशी संपर्क करा.')]);
        }
        $company = CurrentCompany::get();

        $rs = $this->call('post', '/subscriptions', [
            'plan_id' => $this->razorpayPlanId($plan),
            'total_count' => self::TOTAL_COUNT[$plan->interval],
            'customer_notify' => 1,
            'notes' => ['company_id' => (string) $company->id, 'plan_id' => (string) $plan->id],
        ]);

        Subscription::create([
            'plan_id' => $plan->id,
            'user_id' => $user->id,
            'razorpay_subscription_id' => $rs['id'],
            'status' => 'created',
        ]);

        return [
            'key_id' => config('services.razorpay.key_id'),
            'subscription_id' => $rs['id'],
            'name' => $company->name,
            'description' => $plan->name.' – ₹'.number_format($plan->price, 0),
            'prefill' => ['name' => $user->name, 'email' => $user->email, 'contact' => $user->mobile],
        ];
    }

    /** Checkout finished: check Razorpay's signature, then extend the plan. */
    public function verify(string $paymentId, string $subscriptionId, string $signature): Company
    {
        $expected = hash_hmac('sha256', $paymentId.'|'.$subscriptionId, (string) config('services.razorpay.key_secret'));
        if (! $this->enabled() || ! hash_equals($expected, $signature)) {
            throw ValidationException::withMessages(['payment' => __('पेमेंटची खात्री करता आली नाही. पैसे कापले असल्यास काही वेळात प्लॅन आपोआप सुरू होईल.')]);
        }

        $sub = Subscription::where('razorpay_subscription_id', $subscriptionId)->firstOrFail();
        $sub->update(['status' => 'active']);
        $plan = $sub->plan;

        return $this->recordPayment($sub, $paymentId, $plan->price);
    }

    /** Owner turns off auto-renew: the plan stays until its end date. */
    public function cancel(): void
    {
        $sub = $this->renewing(CurrentCompany::require());
        if (! $sub) {
            return;
        }
        if ($this->enabled()) {
            $this->call('post', "/subscriptions/{$sub->razorpay_subscription_id}/cancel", ['cancel_at_cycle_end' => 1]);
        }
        $sub->update(['cancel_at_period_end' => true]);
    }

    /** The company's auto-renewing subscription, if any. */
    public function renewing(int $companyId): ?Subscription
    {
        return Subscription::withoutGlobalScope('company')->where('company_id', $companyId)
            ->where('status', 'active')->where('cancel_at_period_end', false)->latest('id')->first();
    }

    /**
     * Razorpay webhook (no login): signature over the raw body with the webhook secret.
     * Returns false when the signature is wrong.
     */
    public function webhook(string $rawBody, ?string $signature): bool
    {
        $secret = (string) config('services.razorpay.webhook_secret');
        if (! $secret || ! $signature || ! hash_equals(hash_hmac('sha256', $rawBody, $secret), $signature)) {
            return false;
        }

        $event = json_decode($rawBody, true) ?: [];
        $rsId = $event['payload']['subscription']['entity']['id'] ?? null;
        $sub = $rsId ? Subscription::withoutGlobalScope('company')->where('razorpay_subscription_id', $rsId)->first() : null;
        if (! $sub) {
            return true; // not ours / unknown: acknowledge so Razorpay stops retrying
        }

        CurrentCompany::run($sub->company_id, function () use ($event, $sub) {
            match ($event['event'] ?? '') {
                'subscription.activated' => $sub->update(['status' => 'active']),
                'subscription.charged' => $this->charged($sub, $event['payload']['payment']['entity'] ?? []),
                'subscription.cancelled' => $sub->update(['status' => 'cancelled']),
                'subscription.halted' => $sub->update(['status' => 'halted']),
                'subscription.completed' => $sub->update(['status' => 'completed']),
                default => null,
            };
        });

        return true;
    }

    private function charged(Subscription $sub, array $payment): void
    {
        if (empty($payment['id'])) {
            return;
        }
        $sub->update(['status' => 'active']);
        $this->recordPayment($sub, $payment['id'], ((int) ($payment['amount'] ?? 0)) / 100 ?: $sub->plan->price);
    }

    /** Store the payment once and extend the company's plan by one interval. */
    private function recordPayment(Subscription $sub, string $paymentId, float $amount): Company
    {
        return DB::transaction(function () use ($sub, $paymentId, $amount) {
            $company = Company::whereKey($sub->company_id)->lockForUpdate()->firstOrFail();
            if (BillingPayment::withoutGlobalScope('company')->where('razorpay_payment_id', $paymentId)->exists()) {
                return $company; // already counted
            }

            $plan = $sub->plan;
            $from = $company->expires_at && $company->expires_at->isFuture() ? $company->expires_at : now()->startOfDay();
            $end = $plan->interval === 'year' ? $from->copy()->addYear() : $from->copy()->addMonth();

            $company->update(['expires_at' => $end, 'plan_id' => $plan->id, 'plan' => $plan->name]);
            BillingPayment::create([
                'company_id' => $company->id,
                'subscription_id' => $sub->id,
                'plan_id' => $plan->id,
                'razorpay_payment_id' => $paymentId,
                'amount' => $amount,
                'period_end' => $end,
            ]);

            return $company;
        });
    }
}
