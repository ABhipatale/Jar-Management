<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class JarBusinessTest extends TestCase
{
    use RefreshDatabase;

    private Customer $rahul;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->create());
        $this->rahul = Customer::create(['name' => 'Rahul', 'mobile' => '9876543210', 'status' => 'active']);
        $this->postJson('/api/jars', ['quantity' => 50])->assertCreated();
    }

    private function entry(array $data)
    {
        return $this->postJson('/api/jar-transactions', $data + [
            'customer_id' => $this->rahul->id,
            'transaction_date' => now()->toDateString(),
        ]);
    }

    public function test_api_requires_login(): void
    {
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer nope')->getJson('/api/dashboard')
            ->assertStatus(401)->assertJson(['message' => 'कृपया पुन्हा लॉगिन करा.']);
    }

    public function test_login_with_email_or_mobile(): void
    {
        $this->app['auth']->forgetGuards();
        User::factory()->create(['name' => 'Owner', 'email' => 'owner@shop.in', 'mobile' => '9404349071', 'password' => 'secret123']);

        $this->postJson('/api/login', ['login' => 'owner@shop.in', 'password' => 'secret123'])->assertOk()->assertJsonStructure(['token']);
        $this->postJson('/api/login', ['login' => '+91 94043 49071', 'password' => 'secret123'])->assertOk();
        $this->postJson('/api/login', ['login' => 'owner@shop.in', 'password' => 'wrong'])->assertStatus(422);
    }

    public function test_spec_example_give_5_return_2_paid_100(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 5, 'rate' => 30, 'payment_type' => 'udhari', 'paid_amount' => 100])
            ->assertCreated()
            ->assertJsonPath('data.amount', 150)
            ->assertJsonPath('data.udhari_amount', 50)
            ->assertJsonPath('data.current_jars', 5)
            ->assertJsonPath('message', 'जार नोंद यशस्वीरित्या जतन झाली.');

        $this->entry(['transaction_type' => 'returned', 'jar_quantity' => 2])
            ->assertCreated()->assertJsonPath('data.current_jars', 3);

        $this->getJson("/api/customers/{$this->rahul->id}")
            ->assertJsonPath('data.current_jars', 3)
            ->assertJsonPath('data.pending_amount', 50);

        $d = $this->getJson('/api/dashboard')->assertOk()->json();
        $this->assertSame(5, $d['period']['given']);
        $this->assertSame(2, $d['period']['returned']);
        $this->assertEquals(100, $d['period']['cash']);
        $this->assertEquals(50, $d['period']['udhari']);
        $this->assertEquals(50, $d['period']['pending']);
        $this->assertSame(3, $d['stock']['customer_jars']);
        $this->assertSame(47, $d['stock']['available_jars']);
    }

    public function test_server_recalculates_amount_and_ignores_client_totals(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 4, 'rate' => 25, 'amount' => 9999, 'udhari_amount' => 0])
            ->assertJsonPath('data.amount', 100)
            ->assertJsonPath('data.paid_amount', 100)   // cash by default
            ->assertJsonPath('data.udhari_amount', 0);
    }

    public function test_cannot_return_more_than_customer_has(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 3, 'rate' => 30]);
        $this->entry(['transaction_type' => 'returned', 'jar_quantity' => 4])
            ->assertStatus(422)->assertJsonPath('message', 'ग्राहकाकडे फक्त 3 जार आहेत. 4 जार परत घेता येणार नाहीत.');
    }

    public function test_cannot_give_more_jars_than_available_in_shop(): void
    {
        // 50 jars in stock (setUp). Give 45 → 5 left.
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 45, 'rate' => 30])->assertCreated();

        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 6, 'rate' => 30])
            ->assertStatus(422)->assertJsonPath('message', 'दुकानात फक्त 5 जार उपलब्ध आहेत. 6 जार देता येणार नाहीत.');
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 5, 'rate' => 30])->assertCreated();

        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 1, 'rate' => 30])
            ->assertStatus(422)->assertJsonPath('message', 'दुकानात एकही जार उपलब्ध नाही. सर्व जार ग्राहकांकडे आहेत किंवा खराब/हरवलेले आहेत.');

        // A return frees a jar again.
        $this->entry(['transaction_type' => 'returned', 'jar_quantity' => 1])->assertCreated();
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 1, 'rate' => 30])->assertCreated();

        $this->getJson('/api/jars/summary')->assertOk()->assertJsonPath('available_jars', 0);
    }

    public function test_give_with_empties_taken_back_in_one_save(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 5, 'rate' => 30]); // holds 5

        // Next delivery: 4 full jars given, 3 empties taken back.
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 4, 'rate' => 30, 'return_quantity' => 3])
            ->assertCreated()
            ->assertJsonPath('data.jar_quantity', 4)
            ->assertJsonPath('data.returned_quantity', 3)
            ->assertJsonPath('data.amount', 120)
            ->assertJsonPath('data.current_jars', 6); // 5 - 3 + 4

        $rows = $this->getJson("/api/customers/{$this->rahul->id}/ledger")->json('rows');
        $this->assertSame(['given', 'returned', 'given'], array_column($rows, 'entry_type'));

        $d = $this->getJson('/api/dashboard')->json('period');
        $this->assertSame(9, $d['given']);
        $this->assertSame(3, $d['returned']);
    }

    public function test_empties_taken_back_cannot_exceed_jars_held_and_nothing_is_saved(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 2, 'rate' => 30]);

        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 3, 'rate' => 30, 'return_quantity' => 5])
            ->assertStatus(422)
            ->assertJsonPath('message', 'ग्राहकाकडे फक्त 2 जार आहेत. 5 जार परत घेता येणार नाहीत.');

        // Both parts rolled back.
        $this->getJson("/api/customers/{$this->rahul->id}")->assertJsonPath('data.current_jars', 2);
    }

    public function test_empties_taken_back_free_up_stock_for_the_same_delivery(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 50, 'rate' => 30]); // shop now empty

        // Swap 5 full for 5 empties: allowed, because the empties come back first.
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 5, 'rate' => 30, 'return_quantity' => 5])
            ->assertCreated()->assertJsonPath('data.current_jars', 50);

        // Without returns there is still no stock.
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 1, 'rate' => 30])->assertStatus(422);
    }

    public function test_cannot_give_jars_before_any_stock_is_added(): void
    {
        $this->putJson('/api/settings', ['total_jars' => 0])->assertOk();

        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 1, 'rate' => 30])
            ->assertStatus(422)->assertJsonPath('message', "अजून स्टॉकमध्ये जार नाहीत. आधी 'जार' विभागात जार जोडा.");
    }

    public function test_cannot_delete_a_return_if_shop_has_no_jars_left_for_it(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 10, 'rate' => 30]);
        $ret = $this->entry(['transaction_type' => 'returned', 'jar_quantity' => 10])->json('data.id');
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 50, 'rate' => 30])->assertCreated(); // shop now empty

        $this->deleteJson("/api/jar-transactions/{$ret}")->assertStatus(422);
    }

    public function test_rejects_negative_and_invalid_values(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => -2, 'rate' => 30])->assertStatus(422);
        $this->entry(['transaction_type' => 'sold', 'jar_quantity' => 2])->assertStatus(422)->assertJsonPath('message', 'चुकीचा व्यवहार प्रकार.');
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 2, 'rate' => 30, 'paid_amount' => 100])->assertStatus(422);
        $this->postJson('/api/customers', ['name' => '', 'mobile' => '9876543210'])->assertStatus(422)->assertJsonPath('message', 'कृपया ग्राहकाचे नाव टाका.');
        $this->postJson('/api/customers', ['name' => 'X', 'mobile' => '12345'])->assertStatus(422)->assertJsonPath('message', 'कृपया योग्य 10 अंकी मोबाईल नंबर टाका.');
        $this->postJson('/api/payments', ['customer_id' => $this->rahul->id, 'payment_date' => now()->toDateString(), 'amount' => -5, 'payment_mode' => 'cash'])->assertStatus(422);
        $this->postJson('/api/payments', ['customer_id' => $this->rahul->id, 'payment_date' => now()->toDateString(), 'amount' => 5, 'payment_mode' => 'cheque'])->assertStatus(422)->assertJsonPath('message', 'चुकीची पेमेंट पद्धत.');
    }

    public function test_payment_over_pending_needs_advance_flag(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 10, 'rate' => 30, 'paid_amount' => 0]); // ₹300 udhari
        $pay = fn (array $x) => $this->postJson('/api/payments', $x + [
            'customer_id' => $this->rahul->id, 'payment_date' => now()->toDateString(), 'payment_mode' => 'upi',
        ]);

        $pay(['amount' => 100])->assertCreated()
            ->assertJsonPath('data.previous_pending', 300)
            ->assertJsonPath('data.remaining_pending', 200)
            ->assertJsonPath('message', 'पेमेंट यशस्वीरित्या मिळाले.');

        $pay(['amount' => 250])->assertStatus(422);
        $pay(['amount' => 250, 'is_advance' => true])->assertCreated()->assertJsonPath('data.remaining_pending', -50);
    }

    public function test_same_client_uuid_is_saved_only_once(): void
    {
        $uuid = (string) Str::uuid();
        $body = ['transaction_type' => 'given', 'jar_quantity' => 2, 'rate' => 30, 'client_uuid' => $uuid];

        $this->entry($body)->assertCreated();
        $this->entry($body)->assertOk()->assertJsonPath('duplicate', true);

        $this->getJson("/api/customers/{$this->rahul->id}")->assertJsonPath('data.current_jars', 2);
    }

    public function test_ledger_running_balance_matches_spec_example(): void
    {
        $day = fn ($d) => now()->subDays($d)->toDateString();
        // 01/09: 10 given, 2 returned, ₹400 bill, ₹300 paid
        $this->entry(['transaction_date' => $day(4), 'transaction_type' => 'given', 'jar_quantity' => 10, 'rate' => 40, 'paid_amount' => 300]);
        $this->entry(['transaction_date' => $day(4), 'transaction_type' => 'returned', 'jar_quantity' => 2]);
        // 05/09 entered BEFORE 03/09 to prove back-dated entries re-order correctly
        $this->entry(['transaction_date' => $day(0), 'transaction_type' => 'given', 'jar_quantity' => 4, 'rate' => 37.5, 'paid_amount' => 0]);
        $this->entry(['transaction_date' => $day(0), 'transaction_type' => 'returned', 'jar_quantity' => 1]);
        $this->entry(['transaction_date' => $day(2), 'transaction_type' => 'given', 'jar_quantity' => 5, 'rate' => 20, 'paid_amount' => 100]);
        $this->entry(['transaction_date' => $day(2), 'transaction_type' => 'returned', 'jar_quantity' => 3]);

        $l = $this->getJson("/api/customers/{$this->rahul->id}/ledger")->assertOk()->json();
        $this->assertSame(13, $l['customer']['current_jars']);
        $this->assertEquals(250, $l['customer']['pending_amount']);
        $this->assertEquals([100, 100, 100, 100, 250, 250], array_column($l['rows'], 'balance'));
        $this->assertEquals(13, end($l['rows'])['jar_balance']);
    }

    public function test_deleting_entries_keeps_balances_consistent(): void
    {
        $give = $this->entry(['transaction_type' => 'given', 'jar_quantity' => 5, 'rate' => 30, 'paid_amount' => 0])->json('data.id');
        $this->entry(['transaction_type' => 'returned', 'jar_quantity' => 4]);

        // Can't delete the give while its jars have come back — jars would go negative.
        $this->deleteJson("/api/jar-transactions/{$give}")->assertStatus(422);

        // Customer with jars/pending can't be deleted.
        $this->deleteJson("/api/customers/{$this->rahul->id}")->assertStatus(422);
    }

    public function test_jar_stock_adjustments(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 10, 'rate' => 30]);
        $this->postJson('/api/jars/adjust', ['action' => 'damaged', 'quantity' => 3])->assertOk();
        $this->postJson('/api/jars/adjust', ['action' => 'lost', 'quantity' => 2])->assertOk()
            ->assertJsonPath('summary.available_jars', 35);
        $this->postJson('/api/jars/adjust', ['action' => 'lost', 'quantity' => 36])->assertStatus(422);

        $m = $this->getJson('/api/reports/monthly')->assertOk()->json('summary');
        $this->assertSame(3, $m['damaged']);
        $this->assertSame(2, $m['lost']);
    }

    public function test_all_reports_respond(): void
    {
        $this->entry(['transaction_type' => 'given', 'jar_quantity' => 2, 'rate' => 30, 'paid_amount' => 20]);
        $this->postJson('/api/expenses', ['expense_date' => now()->toDateString(), 'expense_type' => 'Diesel', 'amount' => 10, 'payment_mode' => 'cash'])->assertCreated();

        foreach (['daily', 'weekly', 'monthly', 'cash', 'udhari', 'pending', 'jar-status'] as $r) {
            $this->getJson("/api/reports/{$r}?search=rah")->assertOk();
        }
        $this->assertEquals(10, $this->getJson('/api/reports/daily')->json('summary.net_cash'));
        $this->assertCount(1, $this->getJson('/api/reports/pending')->json('customers'));
    }
}
