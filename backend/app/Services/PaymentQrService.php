<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyAsset;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/**
 * The shop's payment QR (UPI scanner photo), sent as a link in udhari WhatsApp messages.
 * Stored in the database like the logo (kind "pay-qr"), re-encoded as PNG so only clean
 * image data is ever served back to customers.
 */
class PaymentQrService
{
    public const KIND = 'pay-qr';

    /** Long side of the stored QR; big enough to scan from a phone screen or a print. */
    private const MAX = 1024;

    public function __construct(private SettingService $settings) {}

    public function store(Company $company, UploadedFile $file): void
    {
        $src = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if (! $src) {
            throw ValidationException::withMessages(['qr' => __('हा फोटो वाचता आला नाही. कृपया PNG किंवा JPG निवडा.')]);
        }
        imagepalettetotruecolor($src);

        $w = imagesx($src);
        $h = imagesy($src);
        $scale = min(1, self::MAX / max($w, $h)); // never enlarge
        $cw = max(1, (int) round($w * $scale));
        $ch = max(1, (int) round($h * $scale));

        // White background: a transparent QR would show black squares on a black page.
        $out = imagecreatetruecolor($cw, $ch);
        imagefill($out, 0, 0, imagecolorallocate($out, 255, 255, 255));
        imagecopyresampled($out, $src, 0, 0, 0, 0, $cw, $ch, $w, $h);
        imagedestroy($src);

        ob_start();
        imagepng($out, null, 8);
        $png = (string) ob_get_clean();
        imagedestroy($out);

        CompanyAsset::updateOrCreate(
            ['company_id' => $company->id, 'kind' => self::KIND],
            ['mime' => 'image/png', 'data' => base64_encode($png)]
        );
    }

    public function remove(Company $company): void
    {
        CompanyAsset::where('company_id', $company->id)->where('kind', self::KIND)->delete();
    }

    public function find(Company $company): ?CompanyAsset
    {
        return CompanyAsset::where('company_id', $company->id)->where('kind', self::KIND)->first();
    }

    /** Image URL (relative, for the app); changes when a new QR is uploaded. */
    public function imageUrl(Company $company, ?CompanyAsset $asset = null): ?string
    {
        $asset ??= $this->find($company);

        return $asset ? "/api/companies/{$company->slug}/pay-qr.png?v={$asset->updated_at?->timestamp}" : null;
    }

    /**
     * Public pay page for WhatsApp messages (absolute), or null when the shop has neither a QR
     * nor a UPI ID. The app adds ?a=<amount>.
     */
    public function payUrl(Company $company, bool $hasQr, string $upiId): ?string
    {
        // url() uses the address this request came in on (the app's own API address), so the
        // link is right on live, pre-prod and a local PC alike, whatever APP_URL says.
        return $hasQr || $upiId !== '' ? url("/api/pay/{$company->slug}") : null;
    }
}
