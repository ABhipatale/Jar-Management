<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlanReminderTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function cronFor(User $u): array
    {
        $this->app['auth']->forgetGuards();

        return $this->getJson('/api/cron/reminders')->assertOk()->json('companies.'.$u->company->slug.'.plan');
    }

    public function test_app_gets_the_plan_end_date(): void
    {
        $u = User::factory()->create();
        $u->company->update(['plan' => 'monthly', 'expires_at' => '2026-10-10']);
        Sanctum::actingAs($u);

        $this->getJson('/api/me')->assertOk()
            ->assertJsonPath('user.company.expires_at', '2026-10-10')
            ->assertJsonPath('user.company.plan', 'monthly');
    }

    public function test_reminder_goes_out_once_a_day_in_the_last_three_days(): void
    {
        Carbon::setTestNow('2026-10-07 09:00:00');
        $soon = User::factory()->create();
        $soon->company->update(['expires_at' => '2026-10-10']);   // 3 days left
        $later = User::factory()->create();
        $later->company->update(['expires_at' => '2026-10-20']);  // 13 days left
        $never = User::factory()->create();                        // no expiry

        $this->assertSame(['days' => 3, 'sent' => true, 'devices' => 0], $this->cronFor($soon));
        $this->assertFalse($this->cronFor($later)['sent']);
        $this->assertSame(['days' => null, 'sent' => false, 'devices' => 0], $this->cronFor($never));

        // Same day again (cron runs 3×/day): not repeated.
        $this->assertFalse($this->cronFor($soon)['sent']);

        // Next day: reminded again with the new count.
        Carbon::setTestNow('2026-10-08 09:00:00');
        $this->assertSame(['days' => 2, 'sent' => true, 'devices' => 0], $this->cronFor($soon));
    }
}
