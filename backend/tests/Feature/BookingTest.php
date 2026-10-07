<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingTest extends TestCase
{
    use RefreshDatabase;

    private Customer $rahul;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-05 11:00:00');
        Sanctum::actingAs(User::factory()->create());
        $this->rahul = Customer::create(['name' => 'Rahul', 'mobile' => '9876543210', 'status' => 'active']);
        $this->postJson('/api/jars', ['quantity' => 50])->assertCreated();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function book(array $x = [])
    {
        return $this->postJson('/api/bookings', $x + ['customer_id' => $this->rahul->id, 'delivery_date' => '2026-10-08', 'jar_quantity' => 10]);
    }

    public function test_booking_is_saved_and_listed(): void
    {
        $this->book(['notes' => 'लग्न समारंभ'])->assertCreated()->assertJsonPath('message', 'बुकिंग नोंदवली.');
        $open = $this->getJson('/api/bookings')->assertOk()->json('open');
        $this->assertCount(1, $open);
        $this->assertSame('2026-10-08', $open[0]['delivery_date']);
        $this->assertSame(10, $open[0]['jar_quantity']);

        $this->book(['delivery_date' => '2026-10-04'])->assertStatus(422); // past date
        $this->book(['jar_quantity' => 0])->assertStatus(422);
    }

    public function test_night_before_and_morning_notifications_once_each(): void
    {
        $this->book();

        // 7 Oct, afternoon: too early for the night-before notification.
        Carbon::setTestNow('2026-10-07 15:00:00');
        $this->getJson('/api/cron/reminders')->assertJsonPath('bookings.evening', 0);

        // 7 Oct, 8 PM: tomorrow's booking announced once.
        Carbon::setTestNow('2026-10-07 20:05:00');
        $this->getJson('/api/cron/reminders')->assertJsonPath('bookings.evening', 1);
        $this->getJson('/api/cron/reminders')->assertJsonPath('bookings.evening', 0);

        // 8 Oct, 7 AM: today's delivery announced once; bell counts it.
        Carbon::setTestNow('2026-10-08 07:00:00');
        $this->getJson('/api/cron/reminders')->assertJsonPath('bookings.morning', 1);
        $this->getJson('/api/cron/reminders')->assertJsonPath('bookings.morning', 0);
        $this->getJson('/api/notifications/count')
            ->assertJsonPath('bookings_today.count', 1)
            ->assertJsonPath('bookings_today.jars', 10)
            ->assertJsonPath('unread', 1);
    }

    public function test_booking_made_late_for_tomorrow_does_not_notify_tonight(): void
    {
        Carbon::setTestNow('2026-10-07 21:30:00');
        $this->book(); // for 8 Oct
        $this->getJson('/api/cron/reminders')->assertJsonPath('bookings.evening', 0);
    }

    public function test_delivering_through_a_give_entry_closes_the_booking(): void
    {
        $id = $this->book()->json('data.id');
        Carbon::setTestNow('2026-10-08 10:00:00');

        $tx = $this->postJson('/api/jar-transactions', [
            'customer_id' => $this->rahul->id, 'transaction_date' => '2026-10-08', 'transaction_type' => 'given',
            'jar_quantity' => 10, 'rate' => 30, 'booking_id' => $id,
        ])->assertCreated()->json('data.id');

        $this->assertSame('delivered', Booking::find($id)->status);
        $this->getJson('/api/bookings/today')->assertJsonPath('count', 0);

        // Deleting that entry re-opens the booking.
        $this->deleteJson("/api/jar-transactions/{$tx}")->assertOk();
        $this->assertSame('booked', Booking::find($id)->status);
    }

    public function test_cancel_and_edit(): void
    {
        $id = $this->book()->json('data.id');
        $this->putJson("/api/bookings/{$id}", ['delivery_date' => '2026-10-09', 'jar_quantity' => 12])->assertOk()->assertJsonPath('data.jar_quantity', 12);

        $this->postJson("/api/bookings/{$id}/cancel")->assertOk()->assertJsonPath('message', 'बुकिंग रद्द केली.');
        $this->assertCount(0, $this->getJson('/api/bookings')->json('open'));
        $this->postJson("/api/bookings/{$id}/cancel")->assertStatus(422); // already cancelled
    }
}
