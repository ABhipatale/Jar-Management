<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OpeningJarsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/jars', ['quantity' => 20])->assertCreated();
    }

    private function entry(int $customerId, string $type, int $qty)
    {
        return $this->postJson('/api/jar-transactions', [
            'customer_id' => $customerId, 'transaction_date' => now()->toDateString(), 'transaction_type' => $type,
            'jar_quantity' => $qty, 'rate' => 30, 'payment_type' => 'cash', 'paid_amount' => $type === 'given' ? $qty * 30 : 0,
        ]);
    }

    public function test_old_jars_count_as_held_and_come_out_of_stock(): void
    {
        $id = $this->postJson('/api/customers', ['name' => 'Sunil', 'mobile' => '9876543211', 'opening_jars' => 5])
            ->assertCreated()
            ->assertJsonPath('data.opening_jars', 5)
            ->assertJsonPath('data.current_jars', 5)
            ->json('data.id');

        $this->getJson('/api/jars/summary')->assertJsonPath('customer_jars', 5)->assertJsonPath('available_jars', 15);

        // Old jars can be returned like any other; then 2 more given.
        $this->entry($id, 'returned', 3)->assertCreated()->assertJsonPath('data.current_jars', 2);
        $this->entry($id, 'given', 2)->assertCreated()->assertJsonPath('data.current_jars', 4);
        $this->entry($id, 'returned', 5)->assertStatus(422); // only 4 with the customer

        // Statement starts from the old jars.
        $ledger = $this->getJson("/api/customers/{$id}/ledger")->json();
        $this->assertSame(5, $ledger['opening']['jar_balance']);
        $this->assertSame(2, $ledger['rows'][0]['jar_balance']);
        $this->assertSame(4, $ledger['rows'][1]['jar_balance']);

        // Old jars are not "given" in reports.
        $this->assertSame(2, $this->getJson('/api/reports/monthly')->json('summary.given'));
    }

    public function test_old_jars_must_fit_the_shop_stock(): void
    {
        $this->postJson('/api/customers', ['name' => 'Big', 'mobile' => '9876543212', 'opening_jars' => 21])
            ->assertStatus(422)->assertJsonValidationErrors('opening_jars');

        $this->postJson('/api/customers', ['name' => 'A', 'mobile' => '9876543213', 'opening_jars' => 15])->assertCreated();
        $this->postJson('/api/customers', ['name' => 'B', 'mobile' => '9876543214', 'opening_jars' => 6])->assertStatus(422);
        $this->postJson('/api/customers', ['name' => 'B', 'mobile' => '9876543214', 'opening_jars' => 5])->assertCreated();
        $this->getJson('/api/jars/summary')->assertJsonPath('available_jars', 0);
    }

    public function test_editing_old_jars(): void
    {
        $id = $this->postJson('/api/customers', ['name' => 'Ravi', 'mobile' => '9876543215', 'opening_jars' => 4])->json('data.id');
        $this->entry($id, 'returned', 3)->assertCreated();

        // Correct it up (fits stock) and the statement follows.
        $this->putJson("/api/customers/{$id}", ['name' => 'Ravi', 'mobile' => '9876543215', 'opening_jars' => 6])
            ->assertOk()->assertJsonPath('data.current_jars', 3);
        $this->assertSame(3, $this->getJson("/api/customers/{$id}/ledger")->json('rows.0.jar_balance'));

        // Can't go below what was already returned.
        $this->putJson("/api/customers/{$id}", ['name' => 'Ravi', 'mobile' => '9876543215', 'opening_jars' => 2])
            ->assertStatus(422)->assertJsonValidationErrors('opening_jars');

        // Saving without the field keeps it; delete is blocked while jars are held.
        $this->putJson("/api/customers/{$id}", ['name' => 'Ravi K', 'mobile' => '9876543215'])
            ->assertOk()->assertJsonPath('data.current_jars', 3);
        $this->deleteJson("/api/customers/{$id}")->assertStatus(422);
    }

    public function test_customer_without_old_jars_is_unchanged(): void
    {
        $this->postJson('/api/customers', ['name' => 'Raju', 'mobile' => '9876543216'])
            ->assertCreated()
            ->assertJsonPath('data.opening_jars', 0)
            ->assertJsonPath('data.current_jars', 0);
        $this->getJson('/api/jars/summary')->assertJsonPath('available_jars', 20);
    }
}
