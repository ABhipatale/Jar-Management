<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BillLinkTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_opens_their_bill_without_login(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $c = Customer::create(['name' => 'Rahul', 'mobile' => '9876543210', 'status' => 'active']);
        $this->postJson('/api/jars', ['quantity' => 10])->assertCreated();
        $this->postJson('/api/jar-transactions', [
            'customer_id' => $c->id, 'transaction_date' => now()->toDateString(), 'transaction_type' => 'given',
            'jar_quantity' => 2, 'rate' => 30, 'payment_type' => 'udhari', 'paid_amount' => 0,
        ])->assertCreated();

        $range = ['from' => now()->startOfMonth()->toDateString(), 'to' => now()->toDateString()];
        $token = $this->postJson("/api/customers/{$c->id}/bill-link", $range + ['lang' => 'mr', 'design' => 'classic'])
            ->assertOk()->json('token');

        // Public: no login.
        $this->app['auth']->forgetGuards();
        $r = $this->getJson("/api/public/bills/{$token}")->assertOk();
        $r->assertJsonPath('bill.design', 'classic')
            ->assertJsonPath('ledger.customer.name', 'Rahul')
            ->assertJsonPath('ledger.customer.pending_amount', 60)
            ->assertJsonCount(1, 'ledger.rows');
        $this->assertArrayNotHasKey('default_rate', $r->json('shop'));

        // A changed or made-up token shows nothing.
        $this->getJson('/api/public/bills/'.substr($token, 0, -1).'x')->assertNotFound();
        $this->getJson('/api/public/bills/abc')->assertNotFound();
    }

    public function test_link_is_only_for_own_customers(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $theirs = $this->postJson('/api/customers', ['name' => 'X', 'mobile' => '9876500000'])->json('data');

        Sanctum::actingAs(User::factory()->create()); // another company's owner
        $this->postJson("/api/customers/{$theirs['id']}/bill-link", [
            'from' => '2026-10-01', 'to' => '2026-10-31', 'lang' => 'mr', 'design' => 'classic',
        ])->assertNotFound();
    }
}
