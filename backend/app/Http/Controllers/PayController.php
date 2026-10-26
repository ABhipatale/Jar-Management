<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\CompanyAsset;
use App\Models\Setting;
use App\Services\BrandingService;
use App\Services\PaymentQrService;
use Illuminate\Http\Request;

/**
 * Public, no login: the page a customer opens from an udhari WhatsApp message — the shop's
 * payment QR, its UPI ID and a "pay with UPI app" button for the pending amount.
 * Shows nothing else about the business.
 */
class PayController extends Controller
{
    public function __construct(private PaymentQrService $qr, private BrandingService $branding) {}

    public function page(Request $request, string $slug)
    {
        $company = $this->company($slug);
        $qr = $this->qr->find($company);
        $upi = (string) Setting::withoutGlobalScope('company')->where('company_id', $company->id)->where('key', 'upi_id')->value('value');
        abort_unless($qr || $upi !== '', 404);

        // ?a= is only for display / pre-filling the UPI app; the customer can still change it.
        $a = $request->query('a');
        $amount = is_numeric($a) && $a > 0 && $a <= 1000000 ? round((float) $a, 2) : null;
        $name = $company->name_mr ?: $company->name;

        $upiLink = null;
        if ($upi !== '') {
            $upiLink = 'upi://pay?'.http_build_query(array_filter([
                'pa' => $upi,
                'pn' => $company->name,
                'am' => $amount !== null ? number_format($amount, 2, '.', '') : null,
                'cu' => 'INR',
                'tn' => $company->name,
            ]), '', '&', PHP_QUERY_RFC3986);
        }

        return response()->view('pay', [
            'name' => $name,
            'logo' => $this->branding->forCompany($company)['logo_url'],
            'amount' => $amount,
            'qrUrl' => $qr ? $this->qr->imageUrl($company, $qr) : null,
            'upi' => $upi,
            'upiLink' => $upiLink,
        ])->header('Cache-Control', 'no-store')->header('X-Robots-Tag', 'noindex');
    }

    public function qr(string $slug)
    {
        $asset = CompanyAsset::where('company_id', $this->company($slug)->id)->where('kind', PaymentQrService::KIND)->firstOrFail();

        // The URL carries ?v=<upload time>, so a new QR gets a new URL.
        return response(base64_decode($asset->data), 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'public, max-age=86400',
            'X-Robots-Tag' => 'noindex',
        ]);
    }

    private function company(string $slug): Company
    {
        return Company::where('slug', $slug)->firstOrFail();
    }
}
