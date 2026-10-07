<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Web Push to every phone/browser that turned on notifications in the app.
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY; without them it silently does nothing
 * (reminders still show inside the app).
 */
class PushService
{
    public function enabled(): bool
    {
        return (bool) (config('shop.vapid.public') && config('shop.vapid.private'));
    }

    /**
     * @param  callable(string $locale): array{title:string, body:string, url?:string, tag?:string}  $payload
     * @return int number of devices the notification was delivered to
     */
    public function sendToAll(callable $payload): int
    {
        if (! $this->enabled() || PushSubscription::count() === 0) {
            return 0;
        }

        try {
            $push = new WebPush(['VAPID' => [
                'subject' => config('shop.vapid.subject'),
                'publicKey' => config('shop.vapid.public'),
                'privateKey' => config('shop.vapid.private'),
            ]], ['TTL' => 86400]);

            foreach (PushSubscription::all() as $sub) {
                $push->queueNotification(
                    Subscription::create([
                        'endpoint' => $sub->endpoint,
                        'publicKey' => $sub->p256dh,
                        'authToken' => $sub->auth,
                        'contentEncoding' => 'aes128gcm',
                    ]),
                    json_encode($payload($sub->locale ?: 'mr'), JSON_UNESCAPED_UNICODE)
                );
            }

            $delivered = 0;
            foreach ($push->flush() as $report) {
                if ($report->isSuccess()) {
                    $delivered++;
                } elseif ($report->isSubscriptionExpired()) {
                    // Phone uninstalled the app / turned notifications off.
                    PushSubscription::where('endpoint', $report->getEndpoint())->delete();
                }
            }

            return $delivered;
        } catch (\Throwable $e) {
            // A push problem must never break the app; reminders still show in-app.
            Log::warning('Web push failed: '.$e->getMessage());

            return 0;
        }
    }
}
