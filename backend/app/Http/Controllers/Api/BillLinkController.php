<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Services\BillLinkService;
use App\Services\BrandingService;
use App\Services\PaymentQrService;
use App\Services\SettingService;
use App\Support\CurrentCompany;
use Illuminate\Http\Request;

/**
 * "View your bill" links sent to the customer on WhatsApp. The owner makes a link (logged in);
 * the customer opens it without logging in and sees only that one bill and the shop's
 * name, contacts and payment QR — nothing else about the business.
 */
class BillLinkController extends Controller
{
    public function __construct(private BillLinkService $links) {}

    /** POST /customers/{customer}/bill-link {from, to, lang, design} → {token} */
    public function store(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'lang' => ['required', 'in:mr,en'],
            'design' => ['required', 'in:classic,modern,simple'],
        ]);

        return response()->json([
            'token' => $this->links->make(CurrentCompany::require(), $customer->id, $data['from'], $data['to'], $data['lang'], $data['design']),
            'days' => BillLinkService::DAYS,
        ]);
    }

    /** GET /public/bills/{token} — no login. */
    public function show(string $token, SettingService $settings, PaymentQrService $qr, BrandingService $branding)
    {
        $link = $this->links->parse($token);
        abort_unless($link, 404);

        return CurrentCompany::run($link['company'], function () use ($link, $settings, $qr, $branding) {
            $company = CurrentCompany::get();
            $customer = Customer::find($link['customer']);
            abort_unless($company && $customer, 404);

            $ledger = app(CustomerController::class)
                ->ledger(Request::create('/', 'GET', ['from' => $link['from'], 'to' => $link['to']]), $customer)
                ->getData(true);
            $s = $settings->all();
            $asset = $qr->find($company);

            return response()->json([
                'bill' => $link,
                'ledger' => $ledger,
                // Only what the bill shows.
                'shop' => [
                    'business_name' => $company->name,
                    'business_name_mr' => $company->name_mr ?? '',
                    'business_place_mr' => $s['business_place_mr'],
                    'business_address' => $s['business_address'],
                    'business_mobile' => $s['business_mobile'],
                    'contact_numbers' => $s['contact_numbers'],
                    'owner_name_mr' => $s['owner_name_mr'],
                    'upi_id' => $s['upi_id'],
                    'pay_qr_url' => $qr->imageUrl($company, $asset),
                    'pay_url' => $qr->payUrl($company, (bool) $asset, (string) $s['upi_id']),
                    'branding' => ['logo_url' => $branding->forCompany($company)['logo_url']],
                ],
            ])->header('Cache-Control', 'no-store')->header('X-Robots-Tag', 'noindex');
        });
    }
}
