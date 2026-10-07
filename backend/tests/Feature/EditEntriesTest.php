<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EditEntriesTest extends TestCase
{
    use RefreshDatabase;

    private Customer $rahul;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->create());
        $this->rahul = Customer::create(['name' => 'Rahul', 'mobile' => '9876543210', 'status' => 'active']);
        $this->postJson('/api/jars', ['quantity' => 20])->assertCreated();
    }

    private function give(array $x = [])
    {
        return $this->postJson('/api/jar-transactions', $x + [
            'customer_id' => $this->rahul->id, 'transaction_date' => now()->toDateString(),
            'transaction_type' => 'given', 'jar_quantity' => 5, 'rate' => 30,
        ]);
    }

    private function balance(): array
    {
        return $this->getJson("/api/customers/{$this->rahul->id}")->json('data');
    }

    public function test_udhari_entry_can_be_corrected_to_cash(): void
    {
        $id = $this->give(['payment_type' => 'udhari', 'paid_amount' => 0])->json('data.id');
        $this->assertEquals(150, $this->balance()['pending_amount']);

        $this->putJson("/api/jar-transactions/{$id}", [
            'transaction_date' => now()->toDateString(), 'jar_quantity' => 5, 'rate' => 30, 'payment_type' => 'cash',
        ])->assertOk()
            ->assertJsonPath('message', 'नोंद बदलली.')
            ->assertJsonPath('data.paid_amount', 150)
            ->assertJsonPath('data.udhari_amount', 0)
            ->assertJsonPath('data.pending_amount', 0);

        $this->assertEquals(150, $this->getJson('/api/dashboard')->json('period.cash'));
    }

    public function test_wrong_rate_and_quantity_are_recalculated(): void
    {
        $id = $this->give()->json('data.id');

        $this->putJson("/api/jar-transactions/{$id}", [
            'transaction_date' => now()->toDateString(), 'jar_quantity' => 7, 'rate' => 25, 'payment_type' => 'udhari', 'paid_amount' => 100,
            'amount' => 99999, // ignored: server calculates
        ])->assertOk()->assertJsonPath('data.amount', 175)->assertJsonPath('data.udhari_amount', 75)->assertJsonPath('data.current_jars', 7);

        $rows = $this->getJson("/api/customers/{$this->rahul->id}/ledger")->json('rows');
        $this->assertEquals(75, end($rows)['balance']);
    }

    public function test_edit_respects_stock_and_returns(): void
    {
        $id = $this->give()->json('data.id'); // 5 given, 15 left in shop
        $this->putJson("/api/jar-transactions/{$id}", ['transaction_date' => now()->toDateString(), 'jar_quantity' => 21, 'rate' => 30])
            ->assertStatus(422); // only 15 more available

        $this->postJson('/api/jar-transactions', ['customer_id' => $this->rahul->id, 'transaction_date' => now()->toDateString(), 'transaction_type' => 'returned', 'jar_quantity' => 4]);
        // Customer returned 4 of the 5, so the give can't drop below 4.
        $this->putJson("/api/jar-transactions/{$id}", ['transaction_date' => now()->toDateString(), 'jar_quantity' => 3, 'rate' => 30])
            ->assertStatus(422)
            ->assertJsonPath('message', 'ग्राहकाने यातील काही जार आधीच परत केले आहेत. दिलेले जार 4 पेक्षा कमी करता येणार नाहीत.');
    }

    public function test_return_entry_quantity_can_be_corrected_within_limits(): void
    {
        $this->give(); // holds 5
        $ret = $this->postJson('/api/jar-transactions', ['customer_id' => $this->rahul->id, 'transaction_date' => now()->toDateString(), 'transaction_type' => 'returned', 'jar_quantity' => 2])->json('data.id');

        $this->putJson("/api/jar-transactions/{$ret}", ['transaction_date' => now()->toDateString(), 'jar_quantity' => 5])->assertOk()->assertJsonPath('data.current_jars', 0);
        $this->putJson("/api/jar-transactions/{$ret}", ['transaction_date' => now()->toDateString(), 'jar_quantity' => 6])->assertStatus(422);
    }

    public function test_payment_amount_and_mode_can_be_corrected(): void
    {
        $this->give(['payment_type' => 'udhari', 'paid_amount' => 0]); // owes 150
        $pid = $this->postJson('/api/payments', ['customer_id' => $this->rahul->id, 'payment_date' => now()->toDateString(), 'amount' => 50, 'payment_mode' => 'cash'])->json('data.id');

        $this->putJson("/api/payments/{$pid}", ['payment_date' => now()->toDateString(), 'amount' => 100, 'payment_mode' => 'upi'])
            ->assertOk()
            ->assertJsonPath('message', 'पेमेंट बदलले.')
            ->assertJsonPath('data.previous_pending', 150)
            ->assertJsonPath('data.remaining_pending', 50)
            ->assertJsonPath('data.payment_mode', 'upi');
        $this->assertEquals(50, $this->balance()['pending_amount']);

        // More than owed needs the advance tick.
        $this->putJson("/api/payments/{$pid}", ['payment_date' => now()->toDateString(), 'amount' => 200, 'payment_mode' => 'upi'])->assertStatus(422);
        $this->putJson("/api/payments/{$pid}", ['payment_date' => now()->toDateString(), 'amount' => 200, 'payment_mode' => 'upi', 'is_advance' => true])->assertOk();
        $this->assertEquals(-50, $this->balance()['pending_amount']);
    }

    public function test_customer_and_type_cannot_be_changed_by_edit(): void
    {
        $other = Customer::create(['name' => 'Sunil', 'mobile' => '9823456789', 'status' => 'active']);
        $id = $this->give()->json('data.id');

        $this->putJson("/api/jar-transactions/{$id}", [
            'transaction_date' => now()->toDateString(), 'jar_quantity' => 5, 'rate' => 30,
            'customer_id' => $other->id, 'transaction_type' => 'returned',
        ])->assertOk()->assertJsonPath('data.customer_id', $this->rahul->id)->assertJsonPath('data.transaction_type', 'given');
    }
}
