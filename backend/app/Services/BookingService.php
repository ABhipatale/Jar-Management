<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\JarTransaction;
use Illuminate\Support\Collection;

/**
 * Advance jar bookings ("10 jars on 08-10-2026").
 *
 * Phone notifications (all times IST, app timezone):
 *  - night before (from 6 PM): "tomorrow N bookings · X jars"
 *  - morning of the day (from 5 AM): "today N deliveries · X jars"
 * Each is sent once per date (eve_notified_at / morning_notified_at), from the daily cron
 * and also whenever the app is opened, so a late cron never loses a notification.
 */
class BookingService
{
    public function __construct(private PushService $push) {}

    public function create(array $data): Booking
    {
        $b = Booking::create([
            'customer_id' => $data['customer_id'],
            'delivery_date' => $data['delivery_date'],
            'jar_quantity' => (int) $data['jar_quantity'],
            'notes' => $data['notes'] ?? null,
        ]);
        $this->skipNotificationsAlreadyPast($b);

        return $b;
    }

    public function update(Booking $b, array $data): Booking
    {
        $dateChanged = $b->delivery_date->toDateString() !== $data['delivery_date'];
        $b->update([
            'delivery_date' => $data['delivery_date'],
            'jar_quantity' => (int) $data['jar_quantity'],
            'notes' => $data['notes'] ?? null,
        ] + ($dateChanged ? ['eve_notified_at' => null, 'morning_notified_at' => null] : []));
        if ($dateChanged) {
            $this->skipNotificationsAlreadyPast($b->fresh());
        }

        return $b->fresh();
    }

    /** Booked late (e.g. 9 PM for tomorrow): the owner already knows, no "tonight" notification. */
    private function skipNotificationsAlreadyPast(Booking $b): void
    {
        $date = $b->delivery_date->toDateString();
        if ($date === now()->addDay()->toDateString() && now()->hour >= 18) {
            $b->update(['eve_notified_at' => now()]);
        }
        if ($date === now()->toDateString()) {
            $b->update(['eve_notified_at' => now(), 'morning_notified_at' => now()]);
        }
    }

    /** Delivery saved as a normal give-jars entry. */
    public function markDelivered(int $bookingId, JarTransaction $tx): void
    {
        Booking::whereKey($bookingId)->where('status', 'booked')->where('customer_id', $tx->customer_id)
            ->update(['status' => 'delivered', 'jar_transaction_id' => $tx->id, 'delivered_at' => now(), 'updated_at' => now()]);
    }

    /** The give-jars entry was deleted: the booking is open again. */
    public function reopenFor(JarTransaction $tx): void
    {
        Booking::where('jar_transaction_id', $tx->id)
            ->update(['status' => 'booked', 'jar_transaction_id' => null, 'delivered_at' => null, 'updated_at' => now()]);
    }

    /** Open bookings (overdue + today + future) and the last delivered/cancelled ones. */
    public function list(): array
    {
        $open = Booking::with('customer:id,name,mobile')->where('status', 'booked')
            ->orderBy('delivery_date')->orderBy('id')->get();
        $closed = Booking::with('customer:id,name,mobile')->whereIn('status', ['delivered', 'cancelled'])
            ->orderByDesc('updated_at')->limit(30)->get();

        return [
            'open' => $open->map(fn ($b) => $this->present($b))->all(),
            'closed' => $closed->map(fn ($b) => $this->present($b))->all(),
        ];
    }

    /** Undelivered bookings for a date (default today): count and total jars. */
    public function summaryFor(?string $date = null): array
    {
        $q = Booking::where('status', 'booked')->where('delivery_date', $date ?? now()->toDateString());

        return ['count' => (clone $q)->count(), 'jars' => (int) (clone $q)->sum('jar_quantity')];
    }

    /** @return array{evening:int, morning:int, devices:int} */
    public function runNotifications(): array
    {
        $out = ['evening' => 0, 'morning' => 0, 'devices' => 0];

        // Morning of the delivery day.
        if (now()->hour >= 5) {
            $today = Booking::with('customer:id,name')->where('status', 'booked')
                ->where('delivery_date', now()->toDateString())->whereNull('morning_notified_at')->get();
            if ($today->isNotEmpty()) {
                $out['devices'] += $this->push->sendToAll(fn (string $l) => $this->payload($today, 'today', $l));
                Booking::whereIn('id', $today->pluck('id'))->update(['morning_notified_at' => now()]);
                $out['morning'] = $today->count();
            }
        }

        // Night before.
        if (now()->hour >= 18) {
            $tomorrow = Booking::with('customer:id,name')->where('status', 'booked')
                ->where('delivery_date', now()->addDay()->toDateString())->whereNull('eve_notified_at')->get();
            if ($tomorrow->isNotEmpty()) {
                $out['devices'] += $this->push->sendToAll(fn (string $l) => $this->payload($tomorrow, 'tomorrow', $l));
                Booking::whereIn('id', $tomorrow->pluck('id'))->update(['eve_notified_at' => now()]);
                $out['evening'] = $tomorrow->count();
            }
        }

        return $out;
    }

    private function payload(Collection $items, string $when, string $locale): array
    {
        $jars = $items->sum('jar_quantity');
        $title = $when === 'today'
            ? __('🚚 आज :n डिलिव्हरी · :jars जार', ['n' => $items->count(), 'jars' => $jars], $locale)
            : __('📅 उद्या :n बुकिंग · एकूण :jars जार', ['n' => $items->count(), 'jars' => $jars], $locale);
        $body = $items->take(6)->map(fn ($b) => ($b->customer?->name ?? '').' – '.$b->jar_quantity)->implode(', ')
            .($items->count() > 6 ? '…' : '');

        return ['title' => $title, 'body' => $body, 'url' => '/bookings', 'tag' => 'bookings-'.$when.'-'.now()->toDateString()];
    }

    private function present(Booking $b): array
    {
        return [
            'id' => $b->id,
            'customer_id' => $b->customer_id,
            'customer_name' => $b->customer?->name,
            'customer_mobile' => $b->customer?->mobile,
            'delivery_date' => $b->delivery_date->toDateString(),
            'jar_quantity' => $b->jar_quantity,
            'notes' => $b->notes,
            'status' => $b->status,
            'jar_transaction_id' => $b->jar_transaction_id,
            'delivered_at' => $b->delivered_at?->toDateString(),
        ];
    }
}
