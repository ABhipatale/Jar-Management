<?php

namespace App\Services;

use App\Models\BillingOrder;
use App\Models\BillingPayment;
use App\Models\Company;
use App\Models\Plan;
use App\Models\User;
use App\Support\CurrentCompany;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Plan payments as one-time Razorpay Orders, via Razorpay's REST API. Nothing renews by itself:
 * the company pays again for each month/year (it can also pay early; the time is added on).
 *
 *  1. order(): creates a Razorpay order for the plan's price; the app opens Razorpay Checkout with it.
 *  2. verify(): the app sends back the payment id + signature; we check the signature and
 *     extend the company's plan by one month/year.
 *  3. webhook() (optional backup): Razorpay's order.paid event, for when the payment went
 *     through but the app never called verify() (phone closed, network lost).
 *
 * Every payment is stored once (unique razorpay_payment_id), so the same payment arriving by
 * verify() AND the webhook — or the webhook being retried — extends the plan only once.
 */
class BillingService
{
    private const API = 'https://api.razorpay.com/v1';

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

    /** Start a one-time payment for one period of the plan. Returns what Checkout needs. */
    public function order(Plan $plan, User $user): array
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages(['payment' => __('ऑनलाइन पेमेंट लवकरच सुरू होईल. आत्ता प्लॅनसाठी कृपया सपोर्टशी संपर्क करा.')]);
        }
        $company = CurrentCompany::get();
        $paise = (int) round($plan->price * 100);

        $ro = $this->call('post', '/orders', [
            'amount' => $paise,
            'currency' => 'INR',
            'receipt' => 'c'.$company->id.'-p'.$plan->id.'-'.now()->timestamp,
            'notes' => ['company_id' => (string) $company->id, 'plan_id' => (string) $plan->id],
        ]);

        BillingOrder::create([
            'plan_id' => $plan->id,
            'user_id' => $user->id,
            'razorpay_order_id' => $ro['id'],
            'amount' => $plan->price,
        ]);

        return [
            'key_id' => config('services.razorpay.key_id'),
            'order_id' => $ro['id'],
            'amount' => $paise,
            'currency' => 'INR',
            'name' => $company->name,
            'description' => $plan->name.' – ₹'.number_format($plan->price, 0),
            'prefill' => ['name' => $user->name, 'email' => $user->email, 'contact' => $user->mobile],
        ];
    }

    /** Checkout finished: check Razorpay's signature, then extend the plan. */
    public function verify(string $paymentId, string $orderId, string $signature): Company
    {
        $expected = hash_hmac('sha256', $orderId.'|'.$paymentId, (string) config('services.razorpay.key_secret'));
        if (! $this->enabled() || ! hash_equals($expected, $signature)) {
            throw ValidationException::withMessages(['payment' => __('पेमेंटची खात्री करता आली नाही. पैसे कापले असल्यास काही वेळात प्लॅन आपोआप सुरू होईल.')]);
        }

        $order = BillingOrder::where('razorpay_order_id', $orderId)->firstOrFail();

        return $this->recordPayment($order, $paymentId, $order->amount);
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
        $payment = $event['payload']['payment']['entity'] ?? [];
        $orderId = $event['payload']['order']['entity']['id'] ?? $payment['order_id'] ?? null;
        $order = $orderId ? BillingOrder::withoutGlobalScope('company')->where('razorpay_order_id', $orderId)->first() : null;
        if (! $order || ($event['event'] ?? '') !== 'order.paid' || empty($payment['id'])) {
            return true; // not ours / not interesting: acknowledge so Razorpay stops retrying
        }

        CurrentCompany::run($order->company_id, fn () => $this->recordPayment(
            $order, $payment['id'], ((int) ($payment['amount'] ?? 0)) / 100 ?: $order->amount,
        ));

        return true;
    }

    /** Store the payment once and extend the company's plan by one interval. */
    private function recordPayment(BillingOrder $order, string $paymentId, float $amount): Company
    {
        return DB::transaction(function () use ($order, $paymentId, $amount) {
            $company = Company::whereKey($order->company_id)->lockForUpdate()->firstOrFail();
            if (BillingPayment::withoutGlobalScope('company')->where('razorpay_payment_id', $paymentId)->exists()) {
                return $company; // already counted
            }

            $plan = $order->plan;
            $from = $company->expires_at && $company->expires_at->isFuture() ? $company->expires_at : now()->startOfDay();
            $end = $plan->interval === 'year' ? $from->copy()->addYear() : $from->copy()->addMonth();

            $company->update(['expires_at' => $end, 'plan_id' => $plan->id, 'plan' => $plan->name]);
            $order->update(['status' => 'paid']);
            BillingPayment::create([
                'company_id' => $company->id,
                'billing_order_id' => $order->id,
                'plan_id' => $plan->id,
                'razorpay_payment_id' => $paymentId,
                'amount' => $amount,
                'period_end' => $end,
            ]);

            return $company;
        });
    }
}
