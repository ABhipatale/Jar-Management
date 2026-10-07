<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyAsset;

/**
 * Name, colours, logo and install icons — for a company, or for the platform itself
 * (login page, super-admin panel). Companies without their own logo use the platform's
 * default icons, which ship with the frontend under /icons.
 */
class BrandingService
{
    private const DEFAULT_ICONS = [
        'icon-192' => '/icons/icon-192.png',
        'icon-512' => '/icons/icon-512.png',
        'maskable-512' => '/icons/maskable-512.png',
        'apple-touch' => '/icons/apple-touch-icon.png',
    ];

    /** The app's own colours, the same for every company. */
    private const THEME_COLOR = '#1d45d8';

    private const BACKGROUND_COLOR = '#ffffff';

    public function platform(): array
    {
        $name = (string) config('shop.platform_name');
        $nameMr = (string) (config('shop.platform_name_mr') ?: $name);
        $mr = config('app.locale', 'mr') === 'mr';

        return [
            'company' => null,
            'name' => $name,
            'name_mr' => $nameMr,
            'short_name' => $mr ? $nameMr : $name,
            'theme_color' => self::THEME_COLOR,
            'background_color' => self::BACKGROUND_COLOR,
            'locale' => (string) config('app.locale', 'mr'),
            'logo_url' => null,
            'icons' => self::DEFAULT_ICONS,
            'manifest_url' => '/api/manifest.webmanifest',
        ];
    }

    public function forCompany(Company $company): array
    {
        $hasLogo = CompanyAsset::where('company_id', $company->id)->where('kind', 'logo')->exists();
        $icon = fn (string $kind) => "/api/companies/{$company->slug}/icons/{$kind}.png?v={$company->assets_version}";

        return [
            'company' => $company->slug,
            'name' => $company->name,
            'name_mr' => $company->name_mr ?: $company->name,
            'short_name' => $company->short_name ?: $company->name_mr ?: $company->name,
            'theme_color' => self::THEME_COLOR,
            'background_color' => self::BACKGROUND_COLOR,
            'locale' => $company->locale ?: 'mr',
            'logo_url' => $hasLogo ? $icon('logo') : null,
            'icons' => $hasLogo
                ? array_combine(array_keys(self::DEFAULT_ICONS), array_map($icon, array_keys(self::DEFAULT_ICONS)))
                : self::DEFAULT_ICONS,
            'manifest_url' => "/api/companies/{$company->slug}/manifest.webmanifest?v={$company->assets_version}",
        ];
    }

    /** Web app manifest: what Android/desktop show when the app is installed. */
    public function manifest(array $b): array
    {
        $mr = $b['locale'] === 'mr';
        $name = $mr ? $b['name_mr'] : $b['name'];

        return [
            // A distinct id per company: installing a different company's app is a different app.
            'id' => $b['company'] ? '/?company='.$b['company'] : '/',
            'name' => $name,
            'short_name' => $b['short_name'],
            'description' => $mr ? $name.' – जार व्यवस्थापन' : $name.' – Jar management',
            'lang' => $mr ? 'mr-IN' : 'en-IN',
            'start_url' => '/',
            'scope' => '/',
            'display' => 'standalone',
            'orientation' => 'portrait',
            'background_color' => $b['background_color'],
            'theme_color' => $b['theme_color'],
            'icons' => [
                ['src' => $b['icons']['icon-192'], 'sizes' => '192x192', 'type' => 'image/png'],
                ['src' => $b['icons']['icon-512'], 'sizes' => '512x512', 'type' => 'image/png'],
                ['src' => $b['icons']['maskable-512'], 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ],
        ];
    }
}
