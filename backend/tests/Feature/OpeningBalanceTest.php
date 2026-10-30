<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OpeningBalanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/jars', ['quantity' => 20])->assertCreated();
    }

    public function test_old_udhari_is_part_of_pending_and_the_statement(): void
    {
        $id = $this->postJson('/api/customers', ['name' => 'Sunil', 'mobile' => '9876543211', 'opening_balance' => 500])
            ->assertCreated()
            ->assertJsonPath('data.opening_balance', 500)
            ->assertJsonPath('data.pending_amount', 500)
            ->json('data.id');

        // 2 jars × 30, nothing paid → 60 more udhari; then 200 paid.
        $this->postJson('/api/jar-transactions', [
            'customer_id' => $id, 'transaction_date' => now()->toDateString(), 'transaction_type' => 'given',
            'jar_quantity' => 2, 'rate' => 30, 'payment_type' => 'udhari', 'paid_amount' => 0,
        ])->assertCreated();
        $this->postJson('/api/payments', ['customer_id' => $id, 'payment_date' => now()->toDateString(), 'amount' => 200, 'payment_mode' => 'cash'])
            ->assertCreated();

        $this->getJson("/api/customers/{$id}")->assertJsonPath('data.pending_amount', 360);
        $this->getJson('/api/reports/pending')->assertJsonPath('total', 360);

        $ledger = $this->getJson("/api/customers/{$id}/ledger")->assertOk()->json();
        $this->assertEquals(500, $ledger['opening']['balance']);
        $this->assertEquals(560, $ledger['rows'][0]['balance']);
        $this->assertEquals(360, $ledger['rows'][1]['balance']);

        // Correcting the old udhari later moves every running balance.
        $this->putJson("/api/customers/{$id}", ['name' => 'Sunil', 'mobile' => '9876543211', 'opening_balance' => 400])
            ->assertOk()->assertJsonPath('data.pending_amount', 260);
        $this->assertEquals(260, $this->getJson("/api/customers/{$id}/ledger")->json('rows.1.balance'));

        // Old udhari is not new udhari: period reports and sales are unchanged.
        $this->assertEquals(60, $this->getJson('/api/reports/monthly')->json('summary.udhari'));

        // Cannot delete while old udhari is unpaid.
        $this->deleteJson("/api/customers/{$id}")->assertStatus(422);
    }

    public function test_customer_without_old_udhari_is_unchanged(): void
    {
        $this->postJson('/api/customers', ['name' => 'Raju', 'mobile' => '9876543212'])
            ->assertCreated()
            ->assertJsonPath('data.opening_balance', 0)
            ->assertJsonPath('data.pending_amount', 0);

        // Editing without sending the field keeps it.
        $id = $this->postJson('/api/customers', ['name' => 'Ravi', 'mobile' => '9876543213', 'opening_balance' => 150])->json('data.id');
        $this->putJson("/api/customers/{$id}", ['name' => 'Ravi K', 'mobile' => '9876543213'])
            ->assertOk()->assertJsonPath('data.pending_amount', 150);

        $this->postJson('/api/customers', ['name' => 'Bad', 'mobile' => '9876543214', 'opening_balance' => -5])->assertStatus(422);
    }
}
