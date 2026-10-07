<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyAsset;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Turns one uploaded logo into everything the installed app needs, stored in the database
 * (the Vercel container has no lasting disk):
 *   logo          – up to 512 px, transparency kept (shown in the app header / login)
 *   icon-192/512  – square "any" icons for the manifest
 *   maskable-512  – logo inside the 80 % safe zone on white (Android shapes)
 *   apple-touch   – 180 px, opaque (iPhone home screen ignores transparency)
 */
class IconService
{
    public const KINDS = ['logo', 'icon-192', 'icon-512', 'maskable-512', 'apple-touch'];

    public function store(Company $company, UploadedFile $file): void
    {
        $src = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if (! $src) {
            throw ValidationException::withMessages(['logo' => __('हा फोटो वाचता आला नाही. कृपया PNG किंवा JPG निवडा.')]);
        }
        imagepalettetotruecolor($src);

        $bg = '#ffffff';
        $images = [
            'logo' => $this->fit($src, 512, null, 1.0, false),
            'icon-192' => $this->fit($src, 192, null, 1.0),
            'icon-512' => $this->fit($src, 512, null, 1.0),
            'maskable-512' => $this->fit($src, 512, $bg, 0.8),
            'apple-touch' => $this->fit($src, 180, $bg, 0.9),
        ];
        imagedestroy($src);

        DB::transaction(function () use ($company, $images) {
            foreach ($images as $kind => $png) {
                CompanyAsset::updateOrCreate(
                    ['company_id' => $company->id, 'kind' => $kind],
                    ['mime' => 'image/png', 'data' => base64_encode($png)]
                );
            }
            // New version number → new icon URLs, so phones and browsers fetch the new logo.
            $company->increment('assets_version');
        });
    }

    public function remove(Company $company): void
    {
        DB::transaction(function () use ($company) {
            CompanyAsset::where('company_id', $company->id)->delete();
            $company->increment('assets_version');
        });
    }

    /**
     * Logo centred in a $size square, scaled to $scale of it. $bg = null keeps transparency.
     * $square = false: the logo's own aspect ratio, longest side $size.
     */
    private function fit(\GdImage $src, int $size, ?string $bg, float $scale, bool $square = true): string
    {
        [$w, $h] = [imagesx($src), imagesy($src)];
        $ratio = min($size * $scale / $w, $size * $scale / $h);
        $nw = max(1, (int) round($w * $ratio));
        $nh = max(1, (int) round($h * $ratio));
        [$cw, $ch] = $square ? [$size, $size] : [$nw, $nh];

        $out = imagecreatetruecolor($cw, $ch);
        if ($bg) {
            [$r, $g, $b] = sscanf($bg, '#%02x%02x%02x');
            imagefill($out, 0, 0, imagecolorallocate($out, $r, $g, $b));
        } else {
            imagealphablending($out, false);
            imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
            imagesavealpha($out, true);
            imagealphablending($out, true);
        }
        imagecopyresampled($out, $src, intdiv($cw - $nw, 2), intdiv($ch - $nh, 2), 0, 0, $nw, $nh, $w, $h);

        ob_start();
        imagepng($out, null, 8);
        imagedestroy($out);

        return (string) ob_get_clean();
    }
}
