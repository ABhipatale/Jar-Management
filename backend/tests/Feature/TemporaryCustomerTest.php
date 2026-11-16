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
        Sanctum::actingAs(User::factory()->create());
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
}
