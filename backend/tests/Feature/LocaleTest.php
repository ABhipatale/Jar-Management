<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** API messages follow the X-Locale header: Marathi by default, English with `X-Locale: en`. */
class LocaleTest extends TestCase
{
    use RefreshDatabase;

    private const EN = ['X-Locale' => 'en'];

    private const MR = ['X-Locale' => 'mr'];

    private Customer $rahul;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->create());
        $this->rahul = Customer::create(['name' => 'Rahul', 'mobile' => '9876543210', 'status' => 'active']);
        $this->postJson('/api/jars', ['quantity' => 10])->assertCreated();
    }

    private function give(int $qty, array $headers = [])
    {
        return $this->postJson('/api/jar-transactions', [
            'customer_id' => $this->rahul->id,
            'transaction_date' => now()->toDateString(),
            'transaction_type' => 'given',
            'jar_quantity' => $qty,
            'rate' => 30,
            'paid_amount' => 0,
        ], $headers);
    }

    public function test_stock_message_is_english_with_header_and_marathi_without(): void
    {
        $this->give(11, self::EN)->assertStatus(422)
            ->assertJsonPath('message', 'Only 10 jars available in the shop. Cannot give 11.');

        // No header → back to the Marathi default (no leak from the previous request).
        $this->give(11)->assertStatus(422)
            ->assertJsonPath('message', 'दुकानात फक्त 10 जार उपलब्ध आहेत. 11 जार देता येणार नाहीत.');

        $this->give(11, self::MR)->assertStatus(422)
            ->assertJsonPath('message', 'दुकानात फक्त 10 जार उपलब्ध आहेत. 11 जार देता येणार नाहीत.');

        $this->give(10)->assertCreated();
        $this->give(1, self::EN)->assertStatus(422)
            ->assertJsonPath('message', 'No jars available in the shop. All jars are with customers or damaged/lost.');
    }

    public function test_form_request_message_follows_locale(): void
    {
        $this->postJson('/api/customers', ['name' => '', 'mobile' => '9876543211'], self::EN)
            ->assertStatus(422)->assertJsonPath('message', 'Please enter customer name.');

        $this->postJson('/api/customers', ['name' => '', 'mobile' => '9876543211'])
            ->assertStatus(422)->assertJsonPath('message', 'कृपया ग्राहकाचे नाव टाका.');
    }

    public function test_success_message_follows_locale(): void
    {
        $this->give(5)->assertCreated(); // ₹150 udhari pending
        $pay = fn (array $headers) => $this->postJson('/api/payments', [
            'customer_id' => $this->rahul->id,
            'payment_date' => now()->toDateString(),
            'amount' => 50,
            'payment_mode' => 'cash',
        ], $headers);

        $pay(self::EN)->assertCreated()->assertJsonPath('message', 'Payment received successfully.');
        $pay([])->assertCreated()->assertJsonPath('message', 'पेमेंट यशस्वीरित्या मिळाले.');
    }

    public function test_status_labels_and_exception_messages_follow_locale(): void
    {
        $this->postJson('/api/jars/adjust', ['action' => 'repaired', 'quantity' => 1], self::EN)
            ->assertStatus(422)->assertJsonPath('message', 'Only 0 jars can be marked as available.');

        $this->getJson('/api/customers/999999', self::EN)
            ->assertStatus(404)->assertJsonPath('message', 'Record not found.');
        $this->getJson('/api/customers/999999')
            ->assertStatus(404)->assertJsonPath('message', 'नोंद सापडली नाही.');
    }
}
