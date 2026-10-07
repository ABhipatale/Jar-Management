<?php

namespace Tests\Feature;

use App\Models\BillingPayment;
use App\Models\Company;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-08 10:00:00');
        $this->owner = User::factory()->create();
        Sanctum::actingAs($this->owner);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function keys(): void
    {
        config(['services.razorpay' => ['key_id' => 'rzp_test_key', 'key_secret' => 'secret123', 'webhook_secret' => 'whsec']]);
        Http::fake([
            'api.razorpay.com/v1/plans' => Http::response(['id' => 'plan_RZP1']),
            'api.razorpay.com/v1/subscriptions' => Http::response(['id' => 'sub_RZP1', 'status' => 'created']),
            'api.razorpay.com/v1/subscriptions/*/cancel' => Http::response(['id' => 'sub_RZP1', 'status' => 'active']),
        ]);
    }

    private function monthly(): Plan
    {
        return Plan::where('interval', 'month')->firstOrFail();
    }

    private function webhook(array $event, ?string $secret = 'whsec')
    {
        $body = json_encode($event);

        return $this->call('POST', '/api/billing/webhook', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_RAZORPAY_SIGNATURE' => hash_hmac('sha256', $body, $secret),
        ], $body);
    }

    public function test_starts_with_monthly_250_and_yearly_1999(): void
    {
        $plans = $this->getJson('/api/billing')->assertOk()->assertJsonPath('enabled', false)->json('plans');
        $this->assertSame([['Monthly', 250, 'month'], ['Yearly', 1999, 'year']], array_map(fn ($p) => [$p['name'], (int) $p['price'], $p['interval']], $plans));
    }

    public function test_without_razorpay_keys_payment_is_politely_refused(): void
    {
        $this->postJson('/api/billing/subscribe', ['plan_id' => $this->monthly()->id])
            ->assertStatus(422)->assertJsonValidationErrors('payment');
    }

    public function test_subscribe_verify_extends_the_plan_by_one_month(): void
    {
        $this->keys();
        $this->owner->company->update(['expires_at' => '2026-10-10']); // still 2 days left

        $this->postJson('/api/billing/subscribe', ['plan_id' => $this->monthly()->id])->assertOk()
            ->assertJsonPath('subscription_id', 'sub_RZP1')
            ->assertJsonPath('key_id', 'rzp_test_key');

        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/plans') && $r['item']['amount'] === 25000 && $r['period'] === 'monthly');
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/subscriptions') && $r['plan_id'] === 'plan_RZP1');

        $sig = hash_hmac('sha256', 'pay_1|sub_RZP1', 'secret123');
        $this->postJson('/api/billing/verify', ['razorpay_payment_id' => 'pay_1', 'razorpay_subscription_id' => 'sub_RZP1', 'razorpay_signature' => $sig])
            ->assertOk()->assertJsonPath('expires_at', '2026-11-10'); // added on top of the days left

        $this->assertSame('Monthly', $this->owner->company->fresh()->plan);
        $this->getJson('/api/me')->assertJsonPath('user.company.auto_renew', true);
    }

    public function test_bad_signature_does_not_extend(): void
    {
        $this->keys();
        $this->postJson('/api/billing/subscribe', ['plan_id' => $this->monthly()->id])->assertOk();
        $this->postJson('/api/billing/verify', ['razorpay_payment_id' => 'pay_1', 'razorpay_subscription_id' => 'sub_RZP1', 'razorpay_signature' => 'forged'])
            ->assertStatus(422);
        $this->assertNull($this->owner->company->fresh()->expires_at);
    }

    public function test_renewal_webhook_extends_once_and_rejects_forgeries(): void
    {
        $this->keys();
        $this->owner->company->update(['expires_at' => '2026-10-05']); // already expired
        $this->postJson('/api/billing/subscribe', ['plan_id' => Plan::where('interval', 'year')->value('id')])->assertOk();

        $charged = ['event' => 'subscription.charged', 'payload' => [
            'subscription' => ['entity' => ['id' => 'sub_RZP1', 'status' => 'active']],
            'payment' => ['entity' => ['id' => 'pay_9', 'amount' => 199900, 'currency' => 'INR']],
        ]];
        $this->app['auth']->forgetGuards();
        $this->webhook($charged)->assertOk();
        $this->webhook($charged)->assertOk(); // Razorpay retry: counted once

        $company = Company::find($this->owner->company_id);
        $this->assertSame('2027-10-08', $company->expires_at->toDateString()); // from today, since it had expired
        $this->assertSame(1, BillingPayment::withoutGlobalScope('company')->count());

        $this->webhook($charged, 'wrong-secret')->assertStatus(400);

        $this->webhook(['event' => 'subscription.halted', 'payload' => ['subscription' => ['entity' => ['id' => 'sub_RZP1']]]])->assertOk();
        Sanctum::actingAs($this->owner);
        $this->getJson('/api/me')->assertJsonPath('user.company.auto_renew', false);
    }

    public function test_owner_can_turn_off_auto_renew(): void
    {
        $this->keys();
        $this->postJson('/api/billing/subscribe', ['plan_id' => $this->monthly()->id]);
        $this->postJson('/api/billing/verify', ['razorpay_payment_id' => 'pay_1', 'razorpay_subscription_id' => 'sub_RZP1',
            'razorpay_signature' => hash_hmac('sha256', 'pay_1|sub_RZP1', 'secret123')])->assertOk();

        $this->postJson('/api/billing/cancel')->assertOk();
        Http::assertSent(fn ($r) => str_contains($r->url(), '/subscriptions/sub_RZP1/cancel'));
        $this->getJson('/api/billing')->assertJsonPath('auto_renew', null);
    }

    public function test_expired_company_sees_plans_but_nothing_else(): void
    {
        $this->owner->company->update(['expires_at' => now()->subDay()]);
        $this->getJson('/api/billing')->assertOk()->assertJsonCount(2, 'plans');
        $this->getJson('/api/customers')->assertForbidden()->assertJsonPath('code', 'company_expired');
    }

    public function test_super_admin_manages_plans(): void
    {
        Sanctum::actingAs(User::factory()->superAdmin()->create());
        $id = $this->postJson('/api/admin/plans', ['name' => 'Quarterly', 'price' => 699, 'interval' => 'month'])->assertCreated()->json('data.id');
        $this->putJson("/api/admin/plans/{$id}", ['price' => 650, 'is_active' => false])->assertOk()->assertJsonPath('data.price', 650);
        $this->getJson('/api/admin/plans')->assertOk()->assertJsonCount(3, 'data');

        // Inactive plans are hidden from companies and cannot be bought.
        Sanctum::actingAs($this->owner);
        $this->getJson('/api/billing')->assertJsonCount(2, 'plans');
        $this->postJson('/api/billing/subscribe', ['plan_id' => $id])->assertStatus(422)->assertJsonValidationErrors('plan_id');

        Sanctum::actingAs(User::factory()->superAdmin()->create());
        $this->deleteJson("/api/admin/plans/{$id}")->assertOk();
        $this->getJson('/api/admin/plans')->assertJsonCount(2, 'data');
    }

    public function test_company_users_cannot_manage_plans(): void
    {
        $this->postJson('/api/admin/plans', ['name' => 'Free', 'price' => 1, 'interval' => 'month'])->assertForbidden();
    }
}
