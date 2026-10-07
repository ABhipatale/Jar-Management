<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BrandingTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_branding_and_manifest_without_login(): void
    {
        config(['shop.platform_name' => 'Jar Cloud', 'shop.platform_name_mr' => 'जार क्लाउड']);

        $this->getJson('/api/branding')->assertOk()
            ->assertJsonPath('name', 'Jar Cloud')
            ->assertJsonPath('name_mr', 'जार क्लाउड')
            ->assertJsonPath('company', null)
            ->assertJsonPath('icons.icon-192', '/icons/icon-192.png');

        $this->get('/api/manifest.webmanifest')->assertOk()
            ->assertHeader('Content-Type', 'application/manifest+json')
            // Default language is Marathi, so the installed app gets the Marathi name.
            ->assertJsonPath('name', 'जार क्लाउड')
            ->assertJsonPath('id', '/');
    }

    public function test_company_manifest_uses_its_own_name_colours_and_id(): void
    {
        $c = Company::factory()->create([
            'name' => 'Raj Water', 'name_mr' => 'राज वॉटर', 'short_name' => 'राज', 'slug' => 'raj', 'locale' => 'mr',
        ]);

        $this->get('/api/companies/raj/manifest.webmanifest')->assertOk()
            ->assertHeader('Content-Type', 'application/manifest+json')
            ->assertJsonPath('id', '/?company=raj')
            ->assertJsonPath('name', 'राज वॉटर')
            ->assertJsonPath('short_name', 'राज')
            // Same app colours for every company.
            ->assertJsonPath('theme_color', '#1d45d8')
            ->assertJsonPath('background_color', '#ffffff')
            // No logo uploaded yet: platform default icons.
            ->assertJsonPath('icons.0.src', '/icons/icon-192.png');

        $c->update(['locale' => 'en']);
        $this->get('/api/companies/raj/manifest.webmanifest')->assertJsonPath('name', 'Raj Water');

        $this->getJson('/api/companies/nope/branding')->assertNotFound();
        $this->get('/api/companies/nope/manifest.webmanifest')->assertNotFound();
    }

    public function test_owner_uploads_logo_and_icons_are_generated(): void
    {
        $owner = User::factory()->create();
        $slug = $owner->company->slug;
        Sanctum::actingAs($owner);

        $res = $this->post('/api/settings/logo', ['logo' => UploadedFile::fake()->image('logo.png', 640, 400)], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('branding.icons.icon-192', "/api/companies/{$slug}/icons/icon-192.png?v=1");

        foreach (['icon-192' => [192, 192], 'icon-512' => [512, 512], 'maskable-512' => [512, 512], 'apple-touch' => [180, 180], 'logo' => [512, 320]] as $kind => [$w, $h]) {
            $img = $this->get("/api/companies/{$slug}/icons/{$kind}.png?v=1")->assertOk()
                ->assertHeader('Content-Type', 'image/png');
            $this->assertStringContainsString('immutable', $img->headers->get('Cache-Control'));
            [$gotW, $gotH] = getimagesizefromstring($img->getContent());
            $this->assertSame([$w, $h], [$gotW, $gotH], $kind);
        }

        $this->get("/api/companies/{$slug}/manifest.webmanifest")
            ->assertJsonPath('icons.0.src', "/api/companies/{$slug}/icons/icon-192.png?v=1");

        // A new logo changes the icon URLs, so phones fetch it instead of a cached one.
        $this->post('/api/settings/logo', ['logo' => UploadedFile::fake()->image('new.jpg', 300, 300)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('branding.icons.icon-512', "/api/companies/{$slug}/icons/icon-512.png?v=2");

        $this->deleteJson('/api/settings/logo')->assertOk()->assertJsonPath('branding.logo_url', null)
            ->assertJsonPath('branding.icons.icon-192', '/icons/icon-192.png');
        $this->get("/api/companies/{$slug}/icons/icon-192.png")->assertNotFound();
        $this->get("/api/companies/{$slug}/icons/secret.png")->assertNotFound();
    }

    public function test_bad_logo_files_are_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->post('/api/settings/logo', ['logo' => UploadedFile::fake()->create('logo.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('logo');
    }

    public function test_settings_change_only_this_companys_name(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $bName = $b->company->name;

        Sanctum::actingAs($a);
        $this->putJson('/api/settings', [
            'business_name' => 'Ganesh Water', 'business_name_mr' => 'गणेश वॉटर', 'short_name' => 'गणेश',
        ])->assertOk()
            ->assertJsonPath('business_name', 'Ganesh Water')
            ->assertJsonPath('branding.name_mr', 'गणेश वॉटर')
            ->assertJsonPath('branding.theme_color', '#1d45d8');

        $this->assertSame('Ganesh Water', $a->company->fresh()->name);
        $this->assertSame($bName, $b->company->fresh()->name);

    }
}
