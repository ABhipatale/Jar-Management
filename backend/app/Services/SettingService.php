<?php

namespace App\Services;

use App\Models\Setting;

class SettingService
{
    /** Editable shop settings and their defaults. Empty WhatsApp templates = app's built-in text. */
    public const DEFAULTS = [
        'business_name' => 'Sai Water Suppliers',
        'business_name_mr' => 'साई वॉटर सप्लायर्स',
        'business_address' => 'Kolewadi',
        'business_place_mr' => 'कोळेवाडी',
        'business_mobile' => '',
        // Shown at the end of every WhatsApp message (संपर्क block).
        'owner_name_mr' => 'श्री. अतुल भागवत',
        'contact_numbers' => '9404349071, 8308285774',
        'default_rate' => '30',
        'jar_tracking' => '0',
        'expense_types' => 'डिझेल,पगार,वीज बिल,जार खरेदी,दुरुस्ती,इतर',
        'wa_delivery' => '',
        'wa_return' => '',
        'wa_payment' => '',
        'wa_reminder' => '',
        'wa_summary' => '',
    ];

    public function all(): array
    {
        $saved = Setting::pluck('value', 'key')->all();

        return array_merge(self::DEFAULTS, array_intersect_key($saved, self::DEFAULTS));
    }

    public function get(string $key): ?string
    {
        return $this->all()[$key] ?? null;
    }

    public function save(array $values): void
    {
        foreach (array_intersect_key($values, self::DEFAULTS) as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => (string) ($value ?? '')]);
        }
    }
}
