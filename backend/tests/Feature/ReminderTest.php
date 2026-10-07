<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Reminder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReminderTest extends TestCase
{
    use RefreshDatabase;

    private Customer $rahul;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-04 10:00:00');
        Sanctum::actingAs(User::factory()->create());
        $this->rahul = Customer::create(['name' => 'Rahul', 'mobile' => '9876543210', 'status' => 'active']);
        $this->postJson('/api/jars', ['quantity' => 20])->assertCreated();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function give(array $x = [])
    {
        return $this->postJson('/api/jar-transactions', $x + [
            'customer_id' => $this->rahul->id, 'transaction_date' => '2026-10-04',
            'transaction_type' => 'given', 'jar_quantity' => 5, 'rate' => 30, 'payment_type' => 'udhari', 'paid_amount' => 0,
        ]);
    }

    public function test_reminder_is_optional_and_scheduled_from_entry_date(): void
    {
        $this->give()->assertCreated(); // no reminder chosen
        $this->assertSame(0, Reminder::count());

        $this->give(['reminder_days' => 15])->assertCreated();
        $this->give(['reminder_days' => 7])->assertCreated();
        $this->give(['reminder_days' => 1])->assertCreated();
        $this->assertEquals(['2026-10-19', '2026-10-11', '2026-10-05'], Reminder::orderBy('id')->get()->map(fn ($r) => $r->remind_on->toDateString())->all());

        $this->give(['reminder_days' => 3])->assertStatus(422); // only 1 / 7 / 15
    }

    public function test_due_reminder_shows_in_app_and_is_processed_once(): void
    {
        $this->give(['reminder_days' => 1]);
        $this->getJson('/api/notifications/count')->assertJsonPath('unread', 0);

        Carbon::setTestNow('2026-10-05 09:00:00');
        $this->getJson('/api/notifications/count')->assertJsonPath('unread', 1);
        $list = $this->getJson('/api/notifications')->assertOk()->json();
        $this->assertCount(1, $list['due']);
        $this->assertSame(5, $list['due'][0]['current_jars']);
        $this->assertEquals(150, $list['due'][0]['pending_amount']);
        $this->assertNotNull(Reminder::first()->pushed_at);

        // Daily job again the same day: nothing new to send.
        $this->getJson('/api/cron/reminders')->assertJsonPath('reminders.notified', 0);

        // Still not clear the next day: reminded again, and it keeps counting on the bell.
        Carbon::setTestNow('2026-10-06 09:00:00');
        $this->getJson('/api/cron/reminders')->assertJsonPath('reminders.notified', 1);
        $this->postJson('/api/notifications/read')->assertOk();
        $this->getJson('/api/notifications/count')->assertJsonPath('unread', 1);
    }

    public function test_due_reminder_disappears_as_soon_as_customer_is_clear(): void
    {
        $this->give(['reminder_days' => 1]); // 5 jars, ₹150 udhari
        Carbon::setTestNow('2026-10-05 09:00:00');
        $this->getJson('/api/notifications/count')->assertJsonPath('unread', 1);

        // Pays everything but still holds jars: stays open.
        $this->postJson('/api/payments', ['customer_id' => $this->rahul->id, 'payment_date' => '2026-10-05', 'amount' => 150, 'payment_mode' => 'cash'])->assertCreated();
        $this->getJson('/api/notifications/count')->assertJsonPath('unread', 1);

        // Returns all jars: account clear, reminder closes immediately.
        $this->postJson('/api/jar-transactions', ['customer_id' => $this->rahul->id, 'transaction_date' => '2026-10-05', 'transaction_type' => 'returned', 'jar_quantity' => 5])->assertCreated();
        $this->getJson('/api/notifications/count')->assertJsonPath('unread', 0);
        $this->assertTrue(Reminder::first()->auto_done);
        $this->assertCount(0, $this->getJson('/api/notifications')->json('due'));

        // Nothing is pushed for it any more.
        Carbon::setTestNow('2026-10-06 09:00:00');
        $this->getJson('/api/cron/reminders')->assertJsonPath('reminders.notified', 0);
    }

    public function test_upcoming_reminder_closes_when_customer_clears_early(): void
    {
        $this->give(['reminder_days' => 15, 'payment_type' => 'cash', 'paid_amount' => 150]);
        $this->assertCount(1, $this->getJson('/api/notifications')->json('upcoming'));

        $this->postJson('/api/jar-transactions', ['customer_id' => $this->rahul->id, 'transaction_date' => '2026-10-04', 'transaction_type' => 'returned', 'jar_quantity' => 5]);
        $list = $this->getJson('/api/notifications')->json();
        $this->assertCount(0, $list['upcoming']);
        $this->assertCount(1, $list['done']);
    }

    public function test_settled_customer_reminder_closes_itself(): void
    {
        $this->give(['reminder_days' => 7, 'payment_type' => 'cash', 'paid_amount' => 150]);
        $this->postJson('/api/jar-transactions', ['customer_id' => $this->rahul->id, 'transaction_date' => '2026-10-04', 'transaction_type' => 'returned', 'jar_quantity' => 5]);

        // Closed right when the account became clear, before it was even due.
        $this->assertTrue(Reminder::first()->auto_done);

        Carbon::setTestNow('2026-10-11 09:00:00');
        $this->getJson('/api/cron/reminders')->assertOk()->assertJsonPath('reminders.notified', 0);
        $this->getJson('/api/notifications/count')->assertJsonPath('unread', 0);
    }

    public function test_done_delete_and_entry_changes(): void
    {
        $id = $this->give(['reminder_days' => 15])->json('data.id');
        $r = Reminder::first();

        // Changing the entry date moves the reminder.
        $this->putJson("/api/jar-transactions/{$id}", ['transaction_date' => '2026-10-01', 'jar_quantity' => 5, 'rate' => 30])->assertOk();
        $this->assertSame('2026-10-16', $r->fresh()->remind_on->toDateString());

        $this->postJson("/api/notifications/{$r->id}/done")->assertOk()->assertJsonPath('message', 'आठवण पूर्ण केली.');
        $this->assertSame('done', $r->fresh()->status);

        // Deleting the entry removes its reminders.
        $this->give(['reminder_days' => 1]);
        $tx2 = Reminder::latest('id')->first()->jar_transaction_id;
        $this->deleteJson("/api/jar-transactions/{$tx2}")->assertOk();
        $this->assertSame(1, Reminder::count());
    }

    public function test_push_subscription_saved_and_cron_is_public(): void
    {
        $this->postJson('/api/push/subscribe', [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123',
            'keys' => ['p256dh' => 'BPkey', 'auth' => 'authkey'],
        ])->assertOk();
        $this->assertDatabaseHas('push_subscriptions', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123', 'locale' => 'mr']);

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', '')->getJson('/api/cron/reminders')->assertOk();
    }
}
