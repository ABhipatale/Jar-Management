<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyAsset;
use App\Services\BrandingService;
use App\Services\IconService;

/**
 * Public (no login) branding, manifest and icons. The browser fetches the manifest and
 * icons itself, without the app's login token, so these cannot require authentication.
 * They only expose what is on the installed app anyway: name, colours and logo.
 */
class BrandingController extends Controller
{
    public function __construct(private BrandingService $branding) {}

    public function platform()
    {
        return response()->json($this->branding->platform());
    }

    public function company(string $slug)
    {
        return response()->json($this->branding->forCompany($this->find($slug)));
    }

    public function platformManifest()
    {
        return $this->manifestResponse($this->branding->platform());
    }

    public function manifest(string $slug)
    {
        return $this->manifestResponse($this->branding->forCompany($this->find($slug)));
    }

    public function icon(string $slug, string $kind)
    {
        abort_unless(in_array($kind, IconService::KINDS, true), 404);
        $asset = CompanyAsset::where('company_id', $this->find($slug)->id)->where('kind', $kind)->firstOrFail();

        // Icon URLs carry ?v=<assets_version>, so a new logo means a new URL: safe to cache for a year.
        return response(base64_decode($asset->data), 200, [
            'Content-Type' => $asset->mime,
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    private function find(string $slug): Company
    {
        return Company::where('slug', $slug)->firstOrFail();
    }

    private function manifestResponse(array $branding)
    {
        // Short cache: a renamed company or new colours reach phones soon.
        return response()->json($this->branding->manifest($branding), 200, [
            'Content-Type' => 'application/manifest+json',
            'Cache-Control' => 'public, max-age=300',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
