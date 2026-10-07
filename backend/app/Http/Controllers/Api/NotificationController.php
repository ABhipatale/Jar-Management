<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Models\Reminder;
use App\Services\BookingService;
use App\Services\PushService;
use App\Services\ReminderService;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private ReminderService $reminders, private BookingService $bookings) {}

    public function index()
    {
        return response()->json($this->reminders->list());
    }

    /** Unread due reminders for the 🔔 badge. Also processes today's reminders once a day. */
    public function count()
    {
        $this->reminders->runDue(lazy: true);
        $this->bookings->runNotifications();
        $today = $this->bookings->summaryFor();

        return response()->json([
            'unread' => $this->reminders->unreadCount() + $today['count'],
            'reminders' => $this->reminders->unreadCount(),
            'bookings_today' => $today,
        ]);
    }

    public function readAll()
    {
        $this->reminders->markAllRead();

        return response()->json(['unread' => 0]);
    }

    public function done(Reminder $reminder)
    {
        $this->reminders->complete($reminder);

        return response()->json(['message' => __('आठवण पूर्ण केली.')]);
    }

    public function destroy(Reminder $reminder)
    {
        $reminder->delete();

        return response()->json(['message' => __('आठवण हटवली.')]);
    }

    // ---- Web Push (phone notifications) -------------------------------------------

    public function pushKey(PushService $push)
    {
        return response()->json(['enabled' => $push->enabled(), 'publicKey' => config('shop.vapid.public')]);
    }

    public function subscribe(Request $request)
    {
        $data = $request->validate([
            'endpoint' => ['required', 'url', 'max:500'],
            'keys.p256dh' => ['required', 'string', 'max:200'],
            'keys.auth' => ['required', 'string', 'max:100'],
        ]);

        PushSubscription::updateOrCreate(
            ['endpoint' => $data['endpoint']],
            [
                'user_id' => $request->user()->id,
                'p256dh' => $data['keys']['p256dh'],
                'auth' => $data['keys']['auth'],
                'locale' => app()->getLocale() === 'en' ? 'en' : 'mr',
            ]
        );

        return response()->json(['message' => __('या फोनवर सूचना चालू झाल्या.')]);
    }

    public function unsubscribe(Request $request)
    {
        $request->validate(['endpoint' => ['required', 'string', 'max:500']]);
        PushSubscription::where('endpoint', $request->input('endpoint'))->delete();

        return response()->json(['message' => __('या फोनवर सूचना बंद केल्या.')]);
    }

    /**
     * Scheduled job (Vercel Cron: ~7 AM, ~9 AM and ~8 PM IST). Public on purpose: it only ever sends reminders
     * that are already due, each once, so calling it again does nothing harmful.
     */
    public function cron()
    {
        // Follow-up reminders go out from 9 AM; the 7 AM run only does the bookings.
        $reminders = now()->hour >= 9 ? $this->reminders->runDue() : null;

        return response()->json(['reminders' => $reminders, 'bookings' => $this->bookings->runNotifications()]);
    }
}
