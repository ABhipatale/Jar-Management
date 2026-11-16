<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TemporaryCustomerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $user = User::factory()->create();
        $user->company->update(['temporary_enabled' => true]);
        Sanctum::actingAs($user);
        $this->postJson('/api/jars', ['quantity' => 20])->assertCreated();
    }

    public function test_customers_are_permanent_unless_marked_temporary(): void
    {
        $this->postJson('/api/customers', ['name' => 'Regular', 'mobile' => '9876543211'])
            ->assertCreated()->assertJsonPath('data.is_temporary', false);
        $id = $this->postJson('/api/customers', ['name' => 'Walk-in', 'mobile' => '9876543212', 'is_temporary' => true])
            ->assertCreated()->assertJsonPath('data.is_temporary', true)->json('data.id');

        $this->assertCount(2, $this->getJson('/api/customers')->json('data'));
        $temp = $this->getJson('/api/customers?filter=temporary')->assertOk()->json('data');
        $this->assertCount(1, $temp);
        $this->assertSame($id, $temp[0]['id']);

        // A temporary customer can be made permanent later.
        $this->putJson("/api/customers/{$id}", ['name' => 'Walk-in', 'mobile' => '9876543212', 'is_temporary' => false])
            ->assertOk()->assertJsonPath('data.is_temporary', false);
        $this->assertCount(0, $this->getJson('/api/customers?filter=temporary')->json('data'));
    }

    public function test_default_type_for_new_customers_is_a_setting(): void
    {
        $this->getJson('/api/settings')->assertJsonPath('new_customer_type', 'permanent');
        $this->putJson('/api/settings', ['new_customer_type' => 'temporary'])->assertOk()->assertJsonPath('new_customer_type', 'temporary');
        $this->putJson('/api/settings', ['new_customer_type' => 'bogus'])->assertUnprocessable();
    }

    public function test_temporary_customer_is_removed_once_settled_but_permanent_is_not(): void
    {
        $give = fn ($id, $paid) => $this->postJson('/api/jar-transactions', [
            'customer_id' => $id, 'transaction_date' => now()->toDateString(), 'transaction_type' => 'given',
            'jar_quantity' => 2, 'rate' => 30, 'payment_type' => $paid ? 'cash' : 'udhari', 'paid_amount' => $paid ? 60 : 0,
        ])->assertCreated();
        $ret = fn ($id) => $this->postJson('/api/jar-transactions', [
            'customer_id' => $id, 'transaction_date' => now()->toDateString(), 'transaction_type' => 'returned', 'jar_quantity' => 2,
        ])->assertCreated()->assertJsonPath('data.customer_name', 'Walk-in');

        $temp = $this->postJson('/api/customers', ['name' => 'Walk-in', 'mobile' => '9876543212', 'is_temporary' => true])->json('data.id');
        $perm = $this->postJson('/api/customers', ['name' => 'Regular', 'mobile' => '9876543211'])->json('data.id');

        // Just added, nothing given yet: stays.
        $this->assertCount(2, $this->getJson('/api/customers')->json('data'));

        $give($temp, true); // paid in cash but still holds 2 jars: stays
        $this->assertCount(2, $this->getJson('/api/customers')->json('data'));
        $ret($temp);        // jars back, nothing owed: removed
        $ids = array_column($this->getJson('/api/customers')->json('data'), 'id');
        $this->assertSame([$perm], $ids);

        // A permanent customer is never removed, even when fully settled.
        $give($perm, true);
        $this->postJson('/api/jar-transactions', [
            'customer_id' => $perm, 'transaction_date' => now()->toDateString(), 'transaction_type' => 'returned', 'jar_quantity' => 2,
        ])->assertCreated();
        $this->assertCount(1, $this->getJson('/api/customers')->json('data'));
    }

    public function test_temporary_customer_with_udhari_stays_until_paid(): void
    {
        $id = $this->postJson('/api/customers', ['name' => 'Walk-in', 'mobile' => '9876543212', 'is_temporary' => true])->json('data.id');
        $this->postJson('/api/jar-transactions', [
            'customer_id' => $id, 'transaction_date' => now()->toDateString(), 'transaction_type' => 'given',
            'jar_quantity' => 2, 'rate' => 30, 'payment_type' => 'udhari', 'paid_amount' => 0,
        ])->assertCreated();
        $this->postJson('/api/jar-transactions', [
            'customer_id' => $id, 'transaction_date' => now()->toDateString(), 'transaction_type' => 'returned', 'jar_quantity' => 2,
        ])->assertCreated();
        $this->assertCount(1, $this->getJson('/api/customers')->json('data')); // jars back but ₹60 udhari

        $this->postJson('/api/payments', ['customer_id' => $id, 'payment_date' => now()->toDateString(), 'amount' => 60, 'payment_mode' => 'cash'])->assertCreated();
        $this->assertCount(0, $this->getJson('/api/customers')->json('data'));
    }

    public function test_feature_is_off_until_the_super_admin_enables_it(): void
    {
        $this->getJson('/api/settings')->assertJsonPath('features.temporary', true);
        $user = User::factory()->create();
        Sanctum::actingAs($user); // a company with the feature off (default)
        $this->getJson('/api/settings')->assertJsonPath('features.temporary', false);
        $this->postJson('/api/jars', ['quantity' => 5])->assertCreated();
        $this->postJson('/api/customers', ['name' => 'Walk-in', 'mobile' => '9876543212', 'is_temporary' => true])
            ->assertCreated()->assertJsonPath('data.is_temporary', false);
    }
}
