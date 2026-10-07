<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SettingsRequest;
use App\Models\Jar;
use App\Services\BrandingService;
use App\Services\IconService;
use App\Services\JarService;
use App\Services\SettingService;
use App\Support\CurrentCompany;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SettingController extends Controller
{
    /** Settings fields that are stored on the company row (name, install label). */
    private const COMPANY_FIELDS = [
        'business_name' => 'name',
        'business_name_mr' => 'name_mr',
        'short_name' => 'short_name',
    ];

    public function __construct(
        private SettingService $settings,
        private JarService $jars,
        private BrandingService $branding,
        private IconService $icons,
    ) {}

    public function show()
    {
        return response()->json($this->payload());
    }

    public function update(SettingsRequest $request)
    {
        $data = $request->validated();

        DB::transaction(function () use ($data) {
            $company = [];
            foreach (self::COMPANY_FIELDS as $field => $column) {
                if (array_key_exists($field, $data)) {
                    $company[$column] = $data[$field] ?: null;
                    unset($data[$field]);
                }
            }
            if ($company) {
                // The name is required; an empty Marathi name / label falls back to it.
                if (array_key_exists('name', $company) && ! $company['name']) {
                    unset($company['name']);
                }
                CurrentCompany::get()->update($company);
            }
            if (array_key_exists('total_jars', $data)) {
                $this->jars->setTotal((int) $data['total_jars']);
                unset($data['total_jars']);
            }
            if (array_key_exists('jar_tracking', $data)) {
                $data['jar_tracking'] = $data['jar_tracking'] ? '1' : '0';
            }
            $this->settings->save($data);
        });

        return response()->json($this->payload() + ['message' => __('सेटिंग्ज जतन झाल्या.')]);
    }

    public function uploadLogo(Request $request)
    {
        $request->validate(['logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:4096']], [
            'logo.required' => __('कृपया लोगो निवडा.'),
            'logo.image' => __('हा फोटो वाचता आला नाही. कृपया PNG किंवा JPG निवडा.'),
            'logo.mimes' => __('हा फोटो वाचता आला नाही. कृपया PNG किंवा JPG निवडा.'),
            'logo.max' => __('लोगो 4 MB पेक्षा लहान असावा.'),
        ]);
        $this->icons->store(CurrentCompany::get(), $request->file('logo'));

        return response()->json($this->payload() + ['message' => __('लोगो जतन झाला.')]);
    }

    public function removeLogo()
    {
        $this->icons->remove(CurrentCompany::get());

        return response()->json($this->payload() + ['message' => __('लोगो काढला.')]);
    }

    private function payload(): array
    {
        $company = CurrentCompany::get()->refresh();

        return $this->settings->all() + [
            'business_name' => $company->name,
            'business_name_mr' => $company->name_mr ?? '',
            'short_name' => $company->short_name ?? '',
            'total_jars' => Jar::count(),
            'branding' => $this->branding->forCompany($company),
        ];
    }
}
