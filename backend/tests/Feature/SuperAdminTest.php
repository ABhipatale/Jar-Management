<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\Company;
use App\Models\Setting;
use App\Models\User;
use App\Support\CurrentCompany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SuperAdminTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->superAdmin()->create(['email' => 'boss@platform.in', 'password' => 'boss12345']);
        Sanctum::actingAs($this->admin);
    }

    private function createCompany(array $x = [])
    {
        return $this->postJson('/api/admin/companies', $x + [
            'name' => 'Raj Water', 'name_mr' => 'राज वॉटर', 'plan_id' => \App\Models\Plan::where('interval', 'month')->value('id'), 'expires_at' => now()->addMonth()->toDateString(),
            'owner_name' => 'Raj', 'owner_email' => 'Raj@Water.in', 'owner_mobile' => '9822001122', 'owner_password' => 'raj12345',
        ]);
    }

    public function test_super_admin_creates_a_company_and_its_owner_can_log_in(): void
    {
        $id = $this->createCompany()->assertCreated()
            ->assertJsonPath('data.slug', 'raj-water')
            ->assertJsonPath('data.owner.email', 'raj@water.in')
            ->json('data.id');

        // Default settings were created for the new company only.
        CurrentCompany::run($id, fn () => $this->assertSame('30', Setting::where('key', 'default_rate')->value('value')));

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['login' => '9822001122', 'password' => 'raj12345'])->assertOk()
            ->assertJsonPath('user.role', 'owner')
            ->assertJsonPath('user.company.slug', 'raj-water');

        $this->assertSame(1, AdminAuditLog::where('action', 'company.created')->where('company_id', $id)->count());
    }

    public function test_slug_is_unique_and_owner_email_cannot_be_reused(): void
    {
        $this->createCompany()->assertCreated();
        $this->createCompany(['owner_email' => 'other@water.in', 'owner_mobile' => '9822001133'])
            ->assertCreated()->assertJsonPath('data.slug', 'raj-water-2');
        $this->createCompany(['owner_mobile' => '9822001144'])->assertStatus(422)->assertJsonValidationErrors('owner_email');
    }

    public function test_list_edit_suspend_activate_and_extend(): void
    {
        $id = $this->createCompany()->json('data.id');

        $this->getJson('/api/admin/companies')->assertOk()
            ->assertJsonPath('data.0.name', 'Raj Water')
            ->assertJsonPath('data.0.users', 1)
            ->assertJsonPath('data.0.owner.mobile', '9822001122');

        $this->putJson("/api/admin/companies/{$id}", ['name' => 'Raj Aqua', 'expires_at' => '2030-01-31'])
            ->assertOk()->assertJsonPath('data.name', 'Raj Aqua')->assertJsonPath('data.expires_at', '2030-01-31');

        $this->postJson("/api/admin/companies/{$id}/suspend")->assertOk()->assertJsonPath('data.status', 'suspended');
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['login' => 'raj@water.in', 'password' => 'raj12345'])->assertStatus(422);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/companies/{$id}/activate")->assertOk()->assertJsonPath('data.status', 'active');
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['login' => 'raj@water.in', 'password' => 'raj12345'])->assertOk();
    }

    public function test_reset_owner_password_logs_out_old_sessions(): void
    {
        $id = $this->createCompany()->json('data.id');
        $this->app['auth']->forgetGuards();
        $old = $this->postJson('/api/login', ['login' => 'raj@water.in', 'password' => 'raj12345'])->json('token');

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/companies/{$id}/owner-password", ['password' => 'new12345'])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/me', ['X-Auth-Token' => $old])->assertUnauthorized();
        $this->postJson('/api/login', ['login' => 'raj@water.in', 'password' => 'new12345'])->assertOk();
    }

    public function test_impersonation_gives_a_company_session_and_is_logged(): void
    {
        $id = $this->createCompany()->json('data.id');
        $token = $this->postJson("/api/admin/companies/{$id}/impersonate")->assertOk()
            ->assertJsonPath('user.impersonating', true)
            ->assertJsonPath('user.company.id', $id)
            ->json('token');

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/me', ['X-Auth-Token' => $token])->assertOk()->assertJsonPath('user.impersonating', true);
        $this->getJson('/api/customers', ['X-Auth-Token' => $token])->assertOk();
        // The impersonation token is a company session, not a super-admin one.
        $this->getJson('/api/admin/companies', ['X-Auth-Token' => $token])->assertForbidden();

        $this->assertSame(1, AdminAuditLog::where('action', 'company.impersonated')->count());
    }

    public function test_deleting_a_company_logs_its_users_out(): void
    {
        $id = $this->createCompany()->json('data.id');
        $this->app['auth']->forgetGuards();
        $token = $this->postJson('/api/login', ['login' => 'raj@water.in', 'password' => 'raj12345'])->json('token');

        Sanctum::actingAs($this->admin);
        $this->deleteJson("/api/admin/companies/{$id}")->assertOk();
        $this->assertSoftDeleted('companies', ['id' => $id]);

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/dashboard', ['X-Auth-Token' => $token])->assertUnauthorized();
        $this->postJson('/api/login', ['login' => 'raj@water.in', 'password' => 'raj12345'])->assertStatus(422);
    }

    public function test_company_users_cannot_reach_the_admin_panel(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/admin/companies')->assertForbidden();
        $this->postJson('/api/admin/companies', [])->assertForbidden();
    }

    public function test_super_admin_logs_in_without_a_company(): void
    {
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['login' => 'boss@platform.in', 'password' => 'boss12345'])->assertOk()
            ->assertJsonPath('user.role', 'super_admin')
            ->assertJsonPath('user.company', null);
    }
}
