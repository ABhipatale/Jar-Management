<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Payment QR in Settings, and the public pay page linked from udhari WhatsApp messages. */
class PayQrTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private string $slug;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create();
        $this->slug = $this->owner->company->slug;
        Sanctum::actingAs($this->owner);
    }

    private function upload()
    {
        return $this->post('/api/settings/pay-qr', ['qr' => UploadedFile::fake()->image('qr.jpg', 600, 600)], ['Accept' => 'application/json']);
    }

    public function test_nothing_set_up_means_no_pay_link_and_no_page(): void
    {
        $this->getJson('/api/settings')->assertOk()->assertJsonPath('pay_url', null)->assertJsonPath('pay_qr_url', null);
        $this->get("/api/pay/{$this->slug}")->assertNotFound();
    }

    public function test_upload_qr_then_customer_opens_the_pay_page(): void
    {
        $res = $this->upload()->assertOk();
        $this->assertStringEndsWith("/api/pay/{$this->slug}", $res->json('pay_url'));
        $img = $res->json('pay_qr_url');
        $this->assertStringStartsWith("/api/companies/{$this->slug}/pay-qr.png?v=", $img);

        // Public: no login needed.
        $this->app['auth']->forgetGuards();
        $png = $this->withHeader('Authorization', '')->get($img)->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->assertStringStartsWith("\x89PNG", $png->getContent()); // re-encoded as a clean PNG

        $page = $this->get("/api/pay/{$this->slug}?a=150")->assertOk();
        $page->assertSee($this->owner->company->name)->assertSee('₹150', false)->assertSee("pay-qr.png?v=", false)
            ->assertDontSee('upi://', false); // no UPI ID yet → no pay button
    }

    public function test_upi_id_adds_a_pay_button_with_the_amount(): void
    {
        $this->putJson('/api/settings', ['upi_id' => 'not an id'])->assertStatus(422)->assertJsonValidationErrors('upi_id');
        $this->putJson('/api/settings', ['upi_id' => '9876543210@ybl'])->assertOk()->assertJsonPath('upi_id', '9876543210@ybl');

        $this->app['auth']->forgetGuards();
        $this->get("/api/pay/{$this->slug}?a=99.5")->assertOk()
            ->assertSee('upi://pay?pa=9876543210%40ybl', false)
            ->assertSee('am=99.50', false)
            ->assertSee('9876543210@ybl');
    }

    public function test_bad_amount_is_ignored(): void
    {
        $this->upload();
        $this->app['auth']->forgetGuards();
        $this->get("/api/pay/{$this->slug}?a=<script>alert(1)</script>")->assertOk()
            ->assertDontSee('<script>alert(1)', false)
            ->assertDontSee('Amount due');
    }

    public function test_removing_the_logo_keeps_the_qr_and_removing_the_qr_removes_the_link(): void
    {
        $this->upload();
        $this->post('/api/settings/logo', ['logo' => UploadedFile::fake()->image('logo.png', 300, 300)], ['Accept' => 'application/json'])->assertOk();
        $this->deleteJson('/api/settings/logo')->assertOk()->assertJsonPath('pay_qr_url', fn ($v) => is_string($v));

        $this->deleteJson('/api/settings/pay-qr')->assertOk()->assertJsonPath('pay_qr_url', null)->assertJsonPath('pay_url', null);
        $this->get("/api/pay/{$this->slug}")->assertNotFound();
    }
}
