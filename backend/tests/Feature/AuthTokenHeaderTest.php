<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTokenHeaderTest extends TestCase
{
    use RefreshDatabase;

    private function loginToken(): string
    {
        User::create(['name' => 'Owner', 'email' => 'owner@shop.in', 'password' => 'secret123']);

        return $this->postJson('/api/login', ['login' => 'owner@shop.in', 'password' => 'secret123', 'remember' => true])
            ->assertOk()->json('token');
    }

    public function test_bearer_header_works(): void
    {
        $token = $this->loginToken();
        $this->getJson('/api/me', ['Authorization' => "Bearer {$token}"])->assertOk();
    }

    public function test_x_auth_token_header_works_without_authorization(): void
    {
        $token = $this->loginToken();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/me', ['X-Auth-Token' => $token])->assertOk()->assertJsonPath('user.email', 'owner@shop.in');
    }

    public function test_bad_or_missing_tokens_are_rejected(): void
    {
        $this->loginToken();
        $this->getJson('/api/me', ['X-Auth-Token' => '1|wrong'])->assertStatus(401);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/me', ['X-Auth-Token' => 'abc|xyz'])->assertStatus(401);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_logout_revokes_token(): void
    {
        $token = $this->loginToken();
        $this->postJson('/api/logout', [], ['X-Auth-Token' => $token])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/me', ['X-Auth-Token' => $token])->assertStatus(401);
    }
}
