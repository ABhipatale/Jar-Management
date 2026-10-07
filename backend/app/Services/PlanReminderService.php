<?php

namespace App\Services;

use App\Support\CurrentCompany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * "Your plan ends soon, please pay": a phone notification to the current company once a day
 * during the last DAYS days before its plan ends. (The app also shows a banner — see Layout.)
 */
class PlanReminderService
{
    public const DAYS = 3;

    public function __construct(private PushService $push, private BillingService $billing) {}

    /** Whole days until the plan ends (null = never ends; 0 or less = already ended). */
    public static function daysLeft(?\DateTimeInterface $expiresAt): ?int
    {
        return $expiresAt ? (int) now()->startOfDay()->diffInDays(Carbon::instance($expiresAt)->startOfDay(), false) : null;
    }

    /** @return array{days:?int, sent:bool, devices:int} */
    public function run(): array
    {
        $company = CurrentCompany::get();
        $days = self::daysLeft($company?->expires_at);

        if ($days === null || $days < 1 || $days > self::DAYS || $this->billing->renewing($company->id)
            || ! Cache::add('plan-reminder:'.$company->id.':'.now()->toDateString(), 1, now()->endOfDay())) {
            return ['days' => $days, 'sent' => false, 'devices' => 0];
        }

        $date = $company->expires_at->format('d/m/Y');
        $devices = $this->push->sendToAll(fn (string $locale) => [
            'title' => __('⚠️ तुमचा प्लॅन लवकरच संपेल', [], $locale),
            'body' => __('तुमचा प्लॅन :days दिवसांत (:date) संपेल. कृपया पेमेंट करा.', ['days' => $days, 'date' => $date], $locale),
            'url' => '/',
            'tag' => 'plan-expiry',
        ]);

        return ['days' => $days, 'sent' => true, 'devices' => $devices];
    }
}
