<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfitReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_month_wise_sales_expenses_and_profit(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $c = Customer::create(['name' => 'Rahul', 'mobile' => '9876543210', 'status' => 'active']);
        $this->postJson('/api/jars', ['quantity' => 50])->assertCreated();

        // March: 5 jars × 30 = 150 sale, 100 paid on the entry, 50 udhari; 20 later paid by UPI.
        $this->postJson('/api/jar-transactions', [
            'customer_id' => $c->id, 'transaction_date' => '2026-03-10', 'transaction_type' => 'given',
            'jar_quantity' => 5, 'rate' => 30, 'payment_type' => 'udhari', 'paid_amount' => 100,
        ])->assertCreated();
        $this->postJson('/api/payments', [
            'customer_id' => $c->id, 'payment_date' => '2026-03-20', 'amount' => 20, 'payment_mode' => 'upi',
        ])->assertCreated();
        // Returning jars is not a sale.
        $this->postJson('/api/jar-transactions', [
            'customer_id' => $c->id, 'transaction_date' => '2026-03-21', 'transaction_type' => 'returned', 'jar_quantity' => 2,
        ])->assertCreated();

        $this->postJson('/api/expenses', ['expense_date' => '2026-03-05', 'expense_type' => 'Diesel', 'amount' => 40, 'payment_mode' => 'cash'])->assertCreated();
        $this->postJson('/api/expenses', ['expense_date' => '2026-04-02', 'expense_type' => 'Salary', 'amount' => 70, 'payment_mode' => 'upi'])->assertCreated();
        // Other years stay out.
        $this->postJson('/api/expenses', ['expense_date' => '2025-12-31', 'expense_type' => 'Diesel', 'amount' => 999, 'payment_mode' => 'cash'])->assertCreated();

        $r = $this->getJson('/api/reports/profit?year=2026')->assertOk()->json();

        $this->assertCount(12, $r['months']);
        $this->assertSame('2026-03', $r['months'][2]['month']);
        $this->assertEquals(150, $r['months'][2]['sales']);
        $this->assertEquals(120, $r['months'][2]['collected']);
        $this->assertEquals(40, $r['months'][2]['expenses']);
        $this->assertEquals(110, $r['months'][2]['profit']);
        $this->assertEquals(-70, $r['months'][3]['profit']);

        $this->assertEquals(150, $r['total']['sales']);
        $this->assertEquals(110, $r['total']['expenses']);
        $this->assertEquals(40, $r['total']['profit']);
        $this->assertSame([['type' => 'Salary', 'amount' => 70], ['type' => 'Diesel', 'amount' => 40]], $r['expense_types']);

        $this->getJson('/api/reports/profit?year=abc')->assertStatus(422);
    }
}
