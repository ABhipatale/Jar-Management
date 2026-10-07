<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Company;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\JarTransaction;
use App\Models\Payment;
use App\Models\Reminder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Company B must never see or touch company A's data — by id, list, report or validation. */
class TenancyIsolationTest extends TestCase
{
    use RefreshDatabase;

    private User $ownerA;
    private User $ownerB;
    private array $a = [];

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-04 10:00:00');

        $this->ownerA = User::factory()->create();
        $this->ownerB = User::factory()->create();

        // Company A: stock, a customer, a give entry with a reminder, a payment, an expense, a booking.
        Sanctum::actingAs($this->ownerA);
        $this->postJson('/api/jars', ['quantity' => 20])->assertCreated();
        $this->a['customer'] = $this->postJson('/api/customers', ['name' => 'Rahul A', 'mobile' => '9876543210'])
            ->assertCreated()->json('data.id');
        $this->a['tx'] = $this->postJson('/api/jar-transactions', [
            'customer_id' => $this->a['customer'], 'transaction_date' => '2026-10-04', 'transaction_type' => 'given',
            'jar_quantity' => 5, 'rate' => 30, 'payment_type' => 'udhari', 'paid_amount' => 0, 'reminder_days' => 1,
        ])->assertCreated()->json('data.id');
        $this->a['payment'] = $this->postJson('/api/payments', [
            'customer_id' => $this->a['customer'], 'payment_date' => '2026-10-04', 'amount' => 50, 'payment_mode' => 'cash',
        ])->assertCreated()->json('data.id');
        $this->a['expense'] = $this->postJson('/api/expenses', [
            'expense_date' => '2026-10-04', 'expense_type' => 'Diesel', 'amount' => 300, 'payment_mode' => 'cash',
        ])->assertCreated()->json('data.id');
        $this->a['booking'] = $this->postJson('/api/bookings', [
            'customer_id' => $this->a['customer'], 'delivery_date' => '2026-10-05', 'jar_quantity' => 3,
        ])->assertCreated()->json('data.id');
        $this->a['reminder'] = Reminder::firstOrFail()->id;

        Sanctum::actingAs($this->ownerB);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_records_of_another_company_are_not_found_by_id(): void
    {
        $c = $this->a['customer'];
        $this->getJson("/api/customers/{$c}")->assertNotFound();
        $this->putJson("/api/customers/{$c}", ['name' => 'Hacked', 'mobile' => '9876543210'])->assertNotFound();
        $this->deleteJson("/api/customers/{$c}")->assertNotFound();
        $this->getJson("/api/customers/{$c}/ledger")->assertNotFound();

        $this->getJson("/api/jar-transactions/{$this->a['tx']}")->assertNotFound();
        $this->putJson("/api/jar-transactions/{$this->a['tx']}", ['jar_quantity' => 1])->assertNotFound();
        $this->deleteJson("/api/jar-transactions/{$this->a['tx']}")->assertNotFound();

        $this->getJson("/api/payments/{$this->a['payment']}")->assertNotFound();
        $this->putJson("/api/payments/{$this->a['payment']}", ['amount' => 1])->assertNotFound();
        $this->deleteJson("/api/payments/{$this->a['payment']}")->assertNotFound();

        $this->deleteJson("/api/expenses/{$this->a['expense']}")->assertNotFound();

        $this->putJson("/api/bookings/{$this->a['booking']}", ['delivery_date' => '2026-10-06', 'jar_quantity' => 1])->assertNotFound();
        $this->postJson("/api/bookings/{$this->a['booking']}/cancel")->assertNotFound();

        $this->postJson("/api/notifications/{$this->a['reminder']}/done")->assertNotFound();
        $this->deleteJson("/api/notifications/{$this->a['reminder']}")->assertNotFound();

        // Nothing of company A changed.
        Sanctum::actingAs($this->ownerA);
        $this->assertSame('Rahul A', Customer::findOrFail($c)->name);
        $this->assertNotNull(JarTransaction::find($this->a['tx']));
        $this->assertNotNull(Payment::find($this->a['payment']));
        $this->assertNotNull(Expense::find($this->a['expense']));
        $this->assertSame('booked', Booking::findOrFail($this->a['booking'])->status);
        $this->assertSame('pending', Reminder::findOrFail($this->a['reminder'])->status);
    }

    public function test_lists_reports_and_dashboard_show_only_own_data(): void
    {
        $this->getJson('/api/customers')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/jar-transactions')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/payments')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/expenses')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/bookings')->assertOk()->assertJsonPath('open', [])->assertJsonPath('closed', []);
        $this->getJson('/api/notifications')->assertOk()->assertJsonPath('due', [])->assertJsonPath('upcoming', []);
        $this->getJson('/api/notifications/count')->assertOk()->assertJsonPath('unread', 0);
        $this->getJson('/api/jars')->assertOk()->assertJsonCount(0, 'jars.data')->assertJsonPath('summary.total_jars', 0);

        $this->getJson('/api/reports/pending')->assertOk()->assertJsonPath('total', 0)->assertJsonPath('customers', []);
        $this->getJson('/api/reports/udhari?from=2026-10-01&to=2026-10-31')->assertOk()
            ->assertJsonPath('summary.udhari', 0)->assertJsonPath('summary.pending', 0)->assertJsonPath('customers', []);
        $this->getJson('/api/reports/cash?from=2026-10-01&to=2026-10-31')->assertOk()
            ->assertJsonPath('summary.expenses', 0)->assertJsonPath('summary.cash', 0)->assertJsonPath('summary.payments', 0);
        $this->getJson('/api/reports/daily?date=2026-10-04')->assertOk()
            ->assertJsonPath('summary.given', 0)->assertJsonPath('summary.sales', 0)->assertJsonPath('customers', []);
        $this->getJson('/api/reports/monthly?month=2026-10')->assertOk()->assertJsonPath('summary.given', 0);
        $this->getJson('/api/reports/jar-status')->assertOk()->assertJsonPath('summary.total_jars', 0)->assertJsonPath('customers', []);

        $this->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('stock.total_jars', 0)
            ->assertJsonPath('stock.customer_jars', 0)
            ->assertJsonPath('today.given', 0)->assertJsonPath('today.sales', 0)->assertJsonPath('recent', [])->assertJsonPath('attention.top_pending', [])
            ->assertJsonPath('customers', []);

        // Company A still sees its own numbers.
        Sanctum::actingAs($this->ownerA);
        $this->getJson('/api/customers')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/dashboard')->assertOk()->assertJsonPath('stock.total_jars', 20)->assertJsonPath('stock.customer_jars', 5);
    }

    public function test_cannot_write_against_another_companys_customer(): void
    {
        $c = $this->a['customer'];
        $this->postJson('/api/jars', ['quantity' => 10])->assertCreated();

        $this->postJson('/api/jar-transactions', [
            'customer_id' => $c, 'transaction_date' => '2026-10-04', 'transaction_type' => 'given',
            'jar_quantity' => 1, 'rate' => 30, 'payment_type' => 'cash', 'paid_amount' => 30,
        ])->assertStatus(422)->assertJsonValidationErrors('customer_id');

        $this->postJson('/api/payments', [
            'customer_id' => $c, 'payment_date' => '2026-10-04', 'amount' => 10, 'payment_mode' => 'cash',
        ])->assertStatus(422)->assertJsonValidationErrors('customer_id');

        $this->postJson('/api/bookings', ['customer_id' => $c, 'delivery_date' => '2026-10-05', 'jar_quantity' => 1])
            ->assertStatus(422)->assertJsonValidationErrors('customer_id');
    }

    public function test_settings_and_jar_numbers_are_per_company(): void
    {
        $this->putJson('/api/settings', ['default_rate' => 45, 'jar_tracking' => true])->assertOk();
        $this->postJson('/api/jars', ['quantity' => 3])->assertCreated();
        // Both companies can have JAR-001.
        $this->getJson('/api/jars')->assertOk()->assertJsonPath('jars.data.0.jar_number', 'JAR-001');

        Sanctum::actingAs($this->ownerA);
        $this->getJson('/api/settings')->assertOk()->assertJsonPath('default_rate', '30')->assertJsonPath('total_jars', 20);
        $this->getJson('/api/jars')->assertOk()->assertJsonPath('jars.data.0.jar_number', 'JAR-001');
    }

    public function test_cron_processes_each_company_on_its_own(): void
    {
        Carbon::setTestNow('2026-10-05 09:00:00');
        // Company B has a customer with a due reminder too.
        $this->postJson('/api/jars', ['quantity' => 5])->assertCreated();
        $b = $this->postJson('/api/customers', ['name' => 'Sunil B', 'mobile' => '9823456789'])->json('data.id');
        $this->postJson('/api/jar-transactions', [
            'customer_id' => $b, 'transaction_date' => '2026-10-04', 'transaction_type' => 'given',
            'jar_quantity' => 2, 'rate' => 30, 'payment_type' => 'udhari', 'paid_amount' => 0, 'reminder_days' => 1,
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $res = $this->getJson('/api/cron/reminders')->assertOk();
        $res->assertJsonPath('companies.'.$this->ownerA->company->slug.'.reminders.notified', 1);
        $res->assertJsonPath('companies.'.$this->ownerB->company->slug.'.reminders.notified', 1);
        $res->assertJsonPath('reminders.notified', 2);

        // Each company's reminder was handled exactly once.
        $this->assertSame(2, Reminder::withoutGlobalScope('company')->whereNotNull('pushed_at')->count());
    }

    public function test_cron_skips_suspended_and_expired_companies(): void
    {
        Carbon::setTestNow('2026-10-05 09:00:00');
        $this->ownerA->company->update(['status' => Company::SUSPENDED]);
        $this->app['auth']->forgetGuards();
        $res = $this->getJson('/api/cron/reminders')->assertOk();
        $this->assertArrayNotHasKey($this->ownerA->company->slug, $res->json('companies'));
    }

    public function test_suspended_or_expired_company_cannot_log_in_or_use_tokens(): void
    {
        $this->app['auth']->forgetGuards();
        $user = User::factory()->create(['email' => 'owner@b.in', 'password' => 'secret123']);
        $token = $this->postJson('/api/login', ['login' => 'owner@b.in', 'password' => 'secret123'])->assertOk()->json('token');

        $user->company->update(['status' => Company::SUSPENDED]);
        $this->postJson('/api/login', ['login' => 'owner@b.in', 'password' => 'secret123'])
            ->assertStatus(422)->assertJsonPath('message', 'तुमच्या कंपनीचे खाते बंद केले आहे. कृपया सपोर्टशी संपर्क करा.');
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/dashboard', ['X-Auth-Token' => $token])->assertForbidden()->assertJsonPath('code', 'company_suspended');

        $user->company->update(['status' => Company::ACTIVE, 'expires_at' => now()->subDay()]);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/dashboard', ['X-Auth-Token' => $token])->assertForbidden()->assertJsonPath('code', 'company_expired');
        $this->postJson('/api/login', ['login' => 'owner@b.in', 'password' => 'secret123'])->assertStatus(422);
    }

    public function test_super_admin_cannot_use_the_business_api_directly(): void
    {
        Sanctum::actingAs(User::factory()->superAdmin()->create());
        $this->getJson('/api/customers')->assertForbidden()->assertJsonPath('code', 'no_company');
        $this->getJson('/api/me')->assertOk()->assertJsonPath('user.role', 'super_admin')->assertJsonPath('user.company', null);
    }
}
