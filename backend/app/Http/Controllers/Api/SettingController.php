<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SettingsRequest;
use App\Models\Jar;
use App\Services\JarService;
use App\Services\SettingService;
use Illuminate\Support\Facades\DB;

class SettingController extends Controller
{
    public function __construct(private SettingService $settings, private JarService $jars) {}

    public function show()
    {
        return response()->json($this->payload());
    }

    public function update(SettingsRequest $request)
    {
        $data = $request->validated();

        DB::transaction(function () use ($data) {
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

    private function payload(): array
    {
        return $this->settings->all() + ['total_jars' => Jar::count()];
    }
}
