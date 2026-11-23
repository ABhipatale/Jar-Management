<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceNumberTest extends TestCase
{
    use RefreshDatabase;

    private int $customer;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->create());
        $this->customer = $this->postJson('/api/customers', ['name' => 'Rahul', 'mobile' => '9876543210'])->json('data.id');
    }

    private function bill(string $from = '2026-11-01', string $to = '2026-11-30'): array
    {
        return ['customer_id' => $this->customer, 'from' => $from, 'to' => $to];
    }

    public function test_numbers_run_one_two_three_and_a_bill_keeps_its_number(): void
    {
        Carbon::setTestNow('2026-11-23 10:00:00');
        $y = now()->year;

        $this->postJson('/api/invoices', $this->bill())->assertOk()->assertJsonPath('number', "B-{$y}-00001");
        $this->postJson('/api/invoices', $this->bill('2026-10-01', '2026-10-31'))->assertOk()->assertJsonPath('number', "B-{$y}-00002");
        // Sending the first bill again does not make a new number.
        $this->postJson('/api/invoices', $this->bill())->assertOk()->assertJsonPath('number', "B-{$y}-00001");
        $this->assertDatabaseCount('invoices', 2);
    }

    public function test_previewing_shows_the_next_number_without_using_it(): void
    {
        Carbon::setTestNow('2026-11-23 10:00:00');
        $q = http_build_query($this->bill());

        $this->getJson("/api/invoices/peek?{$q}")->assertOk()->assertJsonPath('number', 'B-2026-00001')->assertJsonPath('issued', false);
        $this->getJson("/api/invoices/peek?{$q}")->assertJsonPath('number', 'B-2026-00001'); // still the same: nothing was reserved
        $this->assertDatabaseCount('invoices', 0);

        $this->postJson('/api/invoices', $this->bill());
        $this->getJson("/api/invoices/peek?{$q}")->assertJsonPath('number', 'B-2026-00001')->assertJsonPath('issued', true);
    }

    public function test_the_number_starts_again_each_year(): void
    {
        Carbon::setTestNow('2026-12-31 10:00:00');
        $this->postJson('/api/invoices', $this->bill())->assertJsonPath('number', 'B-2026-00001');
        Carbon::setTestNow('2027-01-02 10:00:00');
        $this->postJson('/api/invoices', $this->bill('2026-12-01', '2026-12-31'))->assertJsonPath('number', 'B-2027-00001');
    }

    public function test_manual_bills_use_their_draft_and_customer(): void
    {
        Carbon::setTestNow('2026-11-23 10:00:00');
        $a = ['draft_id' => 'draft-aaaa-1111', 'name' => 'Sunil', 'mobile' => '98765 43211'];

        $this->postJson('/api/invoices', $a)->assertJsonPath('number', 'B-2026-00001');
        $this->postJson('/api/invoices', $a)->assertJsonPath('number', 'B-2026-00001');                       // same bill again
        $this->postJson('/api/invoices', ['name' => 'Anita'] + $a)->assertJsonPath('number', 'B-2026-00002'); // another customer = another bill
        $this->postJson('/api/invoices', ['draft_id' => 'draft-bbbb-2222'] + $a)->assertJsonPath('number', 'B-2026-00003'); // a new draft
    }

    public function test_every_shop_has_its_own_numbers(): void
    {
        Carbon::setTestNow('2026-11-23 10:00:00');
        $this->postJson('/api/invoices', $this->bill())->assertJsonPath('number', 'B-2026-00001');

        Sanctum::actingAs(User::factory()->create()); // another shop
        $theirs = $this->postJson('/api/customers', ['name' => 'Other', 'mobile' => '9123456780'])->json('data.id');
        $this->postJson('/api/invoices', ['customer_id' => $theirs, 'from' => '2026-11-01', 'to' => '2026-11-30'])->assertJsonPath('number', 'B-2026-00001');
        // ...and cannot make a bill for the first shop's customer.
        $this->postJson('/api/invoices', $this->bill())->assertUnprocessable();
    }

    public function test_bad_requests_are_refused(): void
    {
        $this->postJson('/api/invoices', [])->assertUnprocessable();
        $this->postJson('/api/invoices', ['customer_id' => $this->customer])->assertUnprocessable(); // no period
        $this->postJson('/api/invoices', $this->bill('2026-11-30', '2026-11-01'))->assertUnprocessable(); // ends before it starts
        $this->postJson('/api/invoices', ['draft_id' => 'short'])->assertUnprocessable();
    }
}
