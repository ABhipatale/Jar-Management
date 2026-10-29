<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\JarTransaction;
use App\Models\User;
use App\Support\CurrentCompany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** 20 L bottles and refundable deposits: both off by default, switched on per company by the super admin. */
class BottleDepositTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Customer $rahul;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create();
        Sanctum::actingAs($this->owner);
        $this->rahul = Customer::create(['name' => 'Rahul', 'mobile' => '9876543210', 'status' => 'active']);
        $this->postJson('/api/jars', ['quantity' => 20])->assertCreated();
    }

    /** What the super admin does from the panel. */
    private function features(bool $bottles, bool $deposit): void
    {
        $this->owner->company->update(['bottles_enabled' => $bottles, 'deposit_enabled' => $deposit]);
        $this->app->forgetScopedInstances(); // CurrentCompany caches the company per request
    }

    private function entry(array $data)
    {
        return $this->postJson('/api/jar-transactions', $data + [
            'customer_id' => $this->rahul->id,
            'transaction_date' => now()->toDateString(),
        ]);
    }

    public function test_everything_is_off_by_default_and_old_entries_are_jars(): void
    {
        $this->getJson('/api/settings')->assertJsonPath('features', ['bottles' => false, 'deposit' => false]);

        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 2, 'rate' => 30, 'deposit_amount' => 500])
            ->assertCreated()
            ->assertJsonPath('data.product', 'jar')
            ->assertJsonPath('data.deposit_amount', 0) // deposits off: ignored
            ->assertJsonPath('data.current_jars', 2);

        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 1, 'product' => 'bottle'])->assertStatus(422);
        $this->entry(['transaction_type' => 'given', 'lines' => [['product' => 'bottle', 'quantity' => 1]]])->assertStatus(422);
        $this->postJson('/api/jars', ['quantity' => 5, 'product' => 'bottle'])->assertStatus(422);
    }

    public function test_jar_and_bottle_in_one_entry_with_separate_counts_stock_and_rates(): void
    {
        $this->features(true, false);
        $this->postJson('/api/jars', ['quantity' => 10, 'product' => 'bottle'])->assertCreated()
            ->assertJsonPath('summary.total_jars', 10);
        $this->assertSame('BTL-001', \App\Models\Jar::where('product', 'bottle')->orderBy('id')->value('jar_number'));

        $res = $this->entry([
            'transaction_type' => 'given', 'payment_type' => 'udhari', 'paid_amount' => 50,
            'lines' => [
                ['product' => 'jar', 'quantity' => 3, 'rate' => 30],
                ['product' => 'bottle', 'quantity' => 2, 'rate' => 20],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.current_jars', 3)
            ->assertJsonPath('data.current_bottles', 2)
            ->assertJsonPath('data.total_amount', 130)
            ->assertJsonPath('data.total_paid', 50)
            ->assertJsonPath('data.total_udhari', 80)
            ->assertJsonPath('data.pending_amount', 80)
            ->assertJsonCount(2, 'data.lines');
        $this->assertSame(['jar', 'bottle'], array_column($res->json('data.lines'), 'product'));

        // Stock is per product.
        $this->getJson('/api/jars/summary')->assertJsonPath('available_jars', 17)
            ->assertJsonPath('by_product.bottle.available_jars', 8);

        // Can't return more bottles than held; the message talks about bottles.
        $this->entry(['transaction_type' => 'returned', 'lines' => [['product' => 'bottle', 'quantity' => 3]]])
            ->assertStatus(422)->assertJsonValidationErrors('bottle_quantity');

        // Next delivery: 1 jar, 2 empty bottles taken back.
        $this->entry(['transaction_type' => 'given', 'lines' => [
            ['product' => 'jar', 'quantity' => 1, 'rate' => 30],
            ['product' => 'bottle', 'quantity' => 0, 'return_quantity' => 2],
        ]])->assertCreated()
            ->assertJsonPath('data.current_jars', 4)
            ->assertJsonPath('data.current_bottles', 0);

        $ledger = $this->getJson("/api/customers/{$this->rahul->id}/ledger")->json('rows');
        $last = end($ledger);
        $this->assertSame(4, $last['jar_balance']);
        $this->assertSame(0, $last['bottle_balance']);

        // Reports keep jars and bottles apart.
        $d = $this->getJson('/api/dashboard')->json();
        $this->assertSame(4, $d['period']['given']);
        $this->assertSame(2, $d['period']['bottles_given']);
        $this->assertSame(2, $d['period']['bottles_returned']);
        $this->assertSame(10, $d['bottle_stock']['available_jars']);
    }

    public function test_customer_special_rates_can_be_set_and_cleared(): void
    {
        $this->features(true, true);
        $this->putJson("/api/customers/{$this->rahul->id}", [
            'name' => 'Rahul', 'mobile' => '9876543210',
            'takes_bottle' => true, 'jar_rate' => 25, 'bottle_rate' => 18, 'no_deposit' => true,
        ])->assertOk()
            ->assertJsonPath('data.takes_bottle', true)
            ->assertJsonPath('data.jar_rate', 25)
            ->assertJsonPath('data.bottle_rate', 18)
            ->assertJsonPath('data.no_deposit', true);

        $this->putJson("/api/customers/{$this->rahul->id}", ['name' => 'Rahul', 'mobile' => '9876543210', 'jar_rate' => null])
            ->assertOk()
            ->assertJsonPath('data.jar_rate', null)
            ->assertJsonPath('data.bottle_rate', 18);
    }

    public function test_deposit_is_held_apart_from_udhari_and_refunded_on_return(): void
    {
        $this->features(false, true);

        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 2, 'rate' => 30, 'payment_type' => 'udhari', 'paid_amount' => 0, 'deposit_amount' => 300])
            ->assertCreated()
            ->assertJsonPath('data.deposit_amount', 300)
            ->assertJsonPath('data.deposit_held', 300)
            ->assertJsonPath('data.pending_amount', 60); // deposit never in udhari

        $this->getJson("/api/customers/{$this->rahul->id}")->assertJsonPath('data.deposit_held', 300)
            ->assertJsonPath('data.jar_deposit_held', 300);

        // Refund more than held: refused.
        $this->entry(['transaction_type' => 'returned', 'jar_quantity' => 2, 'deposit_amount' => 400])
            ->assertStatus(422)->assertJsonValidationErrors('deposit_amount');

        // The give with a deposit can't be deleted once that deposit was refunded.
        $give = JarTransaction::where('transaction_type', 'given')->first();
        $ret = $this->entry(['transaction_type' => 'returned', 'jar_quantity' => 2, 'deposit_amount' => 300])
            ->assertCreated()->assertJsonPath('data.deposit_held', 0)->json('data.id');
        $this->deleteJson("/api/jar-transactions/{$give->id}")->assertStatus(422);

        // Deposit shows in the ledger and the period report, not in cash.
        $rows = $this->getJson("/api/customers/{$this->rahul->id}/ledger")->json('rows');
        $this->assertEquals(300, $rows[0]['deposit']);
        $this->assertEquals(300, $rows[0]['deposit_balance']);
        $this->assertEquals(0, end($rows)['deposit_balance']);
        $d = $this->getJson('/api/dashboard')->json('period');
        $this->assertEquals(300, $d['deposit_in']);
        $this->assertEquals(300, $d['deposit_out']);
        $this->assertEquals(0, $d['cash']);

        // Editing the refund down puts the deposit back on the customer.
        $this->putJson("/api/jar-transactions/{$ret}", ['transaction_date' => now()->toDateString(), 'jar_quantity' => 2, 'deposit_amount' => 100])
            ->assertOk()->assertJsonPath('data.deposit_held', 200);
    }

    public function test_no_deposit_customer_is_never_charged(): void
    {
        $this->features(false, true);
        $this->rahul->update(['no_deposit' => true]);

        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 1, 'rate' => 30, 'deposit_amount' => 150])
            ->assertCreated()->assertJsonPath('data.deposit_held', 0);
    }

    public function test_customer_with_bottles_or_deposit_cannot_be_deleted(): void
    {
        $this->features(true, true);
        $this->postJson('/api/jars', ['quantity' => 5, 'product' => 'bottle'])->assertCreated();
        $this->entry(['transaction_type' => 'given', 'product' => 'bottle', 'jar_quantity' => 1, 'rate' => 0, 'deposit_amount' => 100])->assertCreated();

        $this->deleteJson("/api/customers/{$this->rahul->id}")->assertStatus(422);
    }

    public function test_bookings_can_include_bottles_only_when_switched_on(): void
    {
        $tomorrow = now()->addDay()->toDateString();
        $book = fn (array $x) => $this->postJson('/api/bookings', $x + ['customer_id' => $this->rahul->id, 'delivery_date' => $tomorrow]);

        // Bottles off: bottle count ignored, jars must be at least 1 (as before).
        $book(['jar_quantity' => 2, 'bottle_quantity' => 5])->assertCreated()->assertJsonPath('data.bottle_quantity', 0);
        $book(['jar_quantity' => 0])->assertStatus(422);

        $this->features(true, false);
        $book(['jar_quantity' => 3, 'bottle_quantity' => 2])->assertCreated()->assertJsonPath('data.bottle_quantity', 2);
        $book(['jar_quantity' => 0, 'bottle_quantity' => 4])->assertCreated(); // bottles only
        $book(['jar_quantity' => 0, 'bottle_quantity' => 0])->assertStatus(422);

        $open = collect($this->getJson('/api/bookings')->json('open'));
        $this->assertSame(6, $open->sum('bottle_quantity'));
        $this->assertSame(5, $open->sum('jar_quantity'));
    }

    public function test_only_the_super_admin_switches_features_and_sees_what_is_outstanding(): void
    {
        $companyId = $this->owner->company_id;

        // The owner can't switch them on through settings.
        $this->putJson('/api/settings', ['bottles_enabled' => true])->assertOk();
        $this->assertFalse($this->owner->company->fresh()->bottles_enabled);

        $this->features(true, true);
        $this->postJson('/api/jars', ['quantity' => 5, 'product' => 'bottle'])->assertCreated();
        $this->entry(['transaction_type' => 'given', 'product' => 'bottle', 'jar_quantity' => 3, 'rate' => 20, 'deposit_amount' => 250])->assertCreated();

        Sanctum::actingAs(User::factory()->superAdmin()->create());
        $this->app->forgetScopedInstances();
        $this->getJson("/api/admin/companies/{$companyId}")
            ->assertJsonPath('data.bottles_enabled', true)
            ->assertJsonPath('data.outstanding.bottles', 3)
            ->assertJsonPath('data.outstanding.deposit', 250);

        $this->putJson("/api/admin/companies/{$companyId}", ['bottles_enabled' => false, 'deposit_enabled' => false])
            ->assertOk()
            ->assertJsonPath('data.bottles_enabled', false)
            ->assertJsonPath('data.deposit_enabled', false);

        // Switching off never deletes data.
        CurrentCompany::run($companyId, fn () => $this->assertSame(1, JarTransaction::where('product', 'bottle')->count()));
    }
}
