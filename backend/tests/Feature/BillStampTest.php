<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Signature & stamp for customer bills: optional, owner-only data, removable. */
class BillStampTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->create());
    }

    public function test_no_stamp_by_default(): void
    {
        $this->getJson('/api/settings')->assertOk()->assertJsonPath('has_stamp', false);
        $this->getJson('/api/settings/stamp')->assertOk()->assertJsonPath('stamp', null);
    }

    public function test_upload_then_remove(): void
    {
        $this->post('/api/settings/stamp', ['stamp' => UploadedFile::fake()->image('s.png', 900, 400)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('has_stamp', true);
        $this->assertStringStartsWith('data:image/png;base64,', $this->getJson('/api/settings/stamp')->json('stamp'));

        $this->deleteJson('/api/settings/stamp')->assertOk()->assertJsonPath('has_stamp', false);
        $this->getJson('/api/settings/stamp')->assertJsonPath('stamp', null);
    }

    public function test_non_image_is_rejected(): void
    {
        $this->post('/api/settings/stamp', ['stamp' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422);
    }
}
