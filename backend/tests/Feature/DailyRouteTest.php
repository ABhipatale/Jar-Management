<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DailyRouteTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-04 08:00:00'); // a Wednesday
        $this->owner = User::factory()->create();
        $this->owner->company->update(['routes_enabled' => true]);
        Sanctum::actingAs($this->owner);
        $this->postJson('/api/jars', ['quantity' => 100])->assertCreated();
    }

    private function customer(string $name, array $route): int
    {
        static $n = 0;
        $n++;

        return $this->postJson('/api/customers', ['name' => $name, 'mobile' => '98765432'.sprintf('%02d', $n)] + $route)
            ->assertCreated()->json('data.id');
    }

    private function give(int $customerId, string $date, int $qty = 1, ?int $stopId = null)
    {
        return $this->postJson('/api/jar-transactions', [
            'customer_id' => $customerId, 'transaction_date' => $date, 'transaction_type' => 'given',
            'jar_quantity' => $qty, 'rate' => 30, 'payment_type' => 'udhari', 'paid_amount' => 10, 'route_stop_id' => $stopId,
        ])->assertCreated();
    }

    private function names(string $session, string $date = '2026-11-04'): array
    {
        return array_column($this->getJson("/api/routes/{$session}?date={$date}")->assertOk()->json('stops'), 'name');
    }

    public function test_who_is_due_follows_each_schedule(): void
    {
        $this->customer('Daily', ['route_morning' => true]);
        $every3 = $this->customer('Every3', ['route_morning' => true, 'schedule_type' => 'every', 'schedule_every' => 3]);
        $this->customer('MonWedFri', ['route_morning' => true, 'schedule_type' => 'weekdays', 'schedule_days' => '1,3,5']);
        $this->customer('TueThu', ['route_morning' => true, 'schedule_type' => 'weekdays', 'schedule_days' => '2,4']);
        $this->customer('OnRequest', ['route_morning' => true, 'schedule_type' => 'booked']);
        $this->customer('NoRoute', []);

        // Every-3: never delivered → due. Delivered on Monday (2 days ago) → not yet; Sunday (3 days) → due.
        $this->assertSame(['Daily', 'Every3', 'MonWedFri'], $this->names('morning'));
        $this->give($every3, '2026-11-02');
        $this->assertSame(['Daily', 'MonWedFri'], $this->names('morning'));
        $this->assertSame(['Daily', 'Every3', 'TueThu'], $this->names('morning', '2026-11-05'));

        // Missed: still due afterwards, shown as overdue.
        $late = collect($this->getJson('/api/routes/morning?date=2026-11-07')->json('stops'))->firstWhere('name', 'Every3');
        $this->assertSame(2, $late['overdue_days']);
    }

    public function test_morning_and_evening_are_separate_and_a_customer_can_be_on_both(): void
    {
        $this->customer('Hotel', ['route_morning' => true, 'route_evening' => true, 'morning_qty' => 5, 'evening_qty' => 3]);
        $this->customer('Home', ['route_evening' => true]);

        $m = $this->getJson('/api/routes/morning')->json('stops');
        $e = $this->getJson('/api/routes/evening')->json('stops');
        $this->assertSame(['Hotel'], array_column($m, 'name'));
        $this->assertSame(5, $m[0]['quantity']);
        $this->assertSame(['Home', 'Hotel'], array_column($e, 'name'));
        $this->assertSame(3, $e[1]['quantity']);
    }

    public function test_start_is_saved_once_and_delivering_moves_on(): void
    {
        $a = $this->customer('Amit', ['route_morning' => true]);
        $b = $this->customer('Bhau', ['route_morning' => true, 'morning_qty' => 2]);

        $this->postJson('/api/routes/morning/start')->assertOk()->assertJsonPath('started', true);
        $this->postJson('/api/routes/morning/start')->assertOk(); // double tap / refresh
        $stops = $this->getJson('/api/routes/morning')->json('stops');
        $this->assertCount(2, $stops);
        $this->assertDatabaseCount('route_stops', 2);

        // Deliver the first stop through the normal jar entry.
        $txId = $this->give($a, '2026-11-04', 2, $stops[0]['id'])->json('data.id');
        $r = $this->getJson('/api/routes/morning')->json();
        $this->assertSame('done', $r['stops'][0]['status']);
        $this->assertSame(2, $r['stops'][0]['delivered']['jars']);
        $this->assertSame(1, $r['totals']['done']);
        $this->assertSame(1, $r['totals']['pending']);
        $this->assertEquals(60, $r['totals']['amount']);
        $this->assertEquals(10, $r['totals']['cash']);
        $this->assertEquals(50, $r['totals']['udhari']);
        $this->getJson("/api/customers/{$a}")->assertJsonPath('data.current_jars', 2)->assertJsonPath('data.pending_amount', 50);

        // A delivered stop can't be skipped or removed…
        $this->patchJson("/api/route-stops/{$stops[0]['id']}", ['status' => 'skipped'])->assertStatus(422);
        $this->deleteJson("/api/route-stops/{$stops[0]['id']}")->assertStatus(422);
        // …but deleting its entry puts it back to "to deliver".
        $this->deleteJson("/api/jar-transactions/{$txId}")->assertOk();
        $this->assertSame('pending', $this->getJson('/api/routes/morning')->json('stops.0.status'));

        // Starting again tomorrow makes a new route; today's is untouched.
        $this->assertFalse($this->getJson('/api/routes/morning?date=2026-11-05')->json('started'));
    }

    public function test_skip_add_remove_and_reorder(): void
    {
        $a = $this->customer('Amit', ['route_morning' => true]);
        $b = $this->customer('Bhau', ['route_morning' => true]);
        $c = $this->customer('Chandu', ['route_morning' => true]);
        $extra = $this->customer('Extra', []);

        $stops = $this->postJson('/api/routes/morning/start')->json('stops');
        [$sa, $sb, $sc] = array_column($stops, 'id');

        $this->patchJson("/api/route-stops/{$sa}", ['status' => 'skipped', 'skip_reason' => 'not_home'])
            ->assertOk()->assertJsonPath('stops.0.status', 'skipped')->assertJsonPath('stops.0.skip_reason', 'not_home')
            ->assertJsonPath('totals.skipped', 1);
        $this->patchJson("/api/route-stops/{$sa}", ['status' => 'pending'])->assertJsonPath('stops.0.status', 'pending');
        $this->patchJson("/api/route-stops/{$sb}", ['quantity' => 4])->assertJsonPath('stops.1.quantity', 4);

        // Manual extra customer (not on any route), once only.
        $this->postJson('/api/routes/morning/stops', ['customer_id' => $extra, 'quantity' => 2])->assertCreated()
            ->assertJsonPath('stops.3.name', 'Extra');
        $this->postJson('/api/routes/morning/stops', ['customer_id' => $extra])->assertStatus(422);
        $this->deleteJson("/api/route-stops/{$sc}")->assertOk();

        // Today's order only…
        $stops = $this->getJson('/api/routes/morning')->json('stops');
        $ids = array_column($stops, 'id');
        $this->postJson('/api/routes/morning/order', ['ids' => array_reverse($ids)])->assertOk()
            ->assertJsonPath('stops.0.name', 'Extra');
        $this->assertSame(['Amit', 'Bhau', 'Chandu'], $this->names('morning', '2026-11-05'));
        // …or kept for future routes.
        $this->postJson('/api/routes/morning/order', ['ids' => array_reverse($ids), 'permanent' => true])->assertOk();
        $this->assertSame(['Bhau', 'Amit', 'Chandu'], $this->names('morning', '2026-11-05'));
    }

    public function test_switched_off_and_other_companies(): void
    {
        $a = $this->customer('Amit', ['route_morning' => true]);
        $stopId = $this->postJson('/api/routes/morning/start')->json('stops.0.id');

        // Another company can't see or touch this route.
        Sanctum::actingAs($other = User::factory()->create());
        $other->company->update(['routes_enabled' => true]);
        $this->assertSame([], $this->getJson('/api/routes/morning')->json('stops'));
        $this->patchJson("/api/route-stops/{$stopId}", ['status' => 'skipped'])->assertNotFound();

        // Routes off: the endpoints don't exist, everything else works as before.
        Sanctum::actingAs($off = User::factory()->create());
        $this->getJson('/api/routes')->assertNotFound();
        $this->getJson('/api/settings')->assertOk()->assertJsonPath('features.routes', false);
    }
}
