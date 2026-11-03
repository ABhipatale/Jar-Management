<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyAsset;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/**
 * The shop's seal / signature picture ("सही शिक्का"), printed on customer bills.
 * Stored in the database like the logo (kind "stamp"), re-encoded as PNG with transparency
 * kept so it sits on the bill like a real stamp. Only the logged-in app can read it back.
 */
class StampService
{
    public const KIND = 'stamp';

    /** Long side of the stored stamp; the bill shows it at about 120 px. */
    private const MAX = 480;

    public function store(Company $company, UploadedFile $file): void
    {
        $src = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if (! $src) {
            throw ValidationException::withMessages(['stamp' => __('हा फोटो वाचता आला नाही. कृपया PNG किंवा JPG निवडा.')]);
        }
        imagepalettetotruecolor($src);

        $w = imagesx($src);
        $h = imagesy($src);
        $scale = min(1, self::MAX / max($w, $h)); // never enlarge
        $cw = max(1, (int) round($w * $scale));
        $ch = max(1, (int) round($h * $scale));

        $out = imagecreatetruecolor($cw, $ch);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagefill($out, 0, 0, imagecolorallocatealpha($out, 255, 255, 255, 127));
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

    /** The stamp as a data URL (for the bill picture / PDF), or null when none is uploaded. */
    public function dataUrl(Company $company): ?string
    {
        $asset = $this->find($company);

        return $asset ? "data:{$asset->mime};base64,{$asset->data}" : null;
    }
}
