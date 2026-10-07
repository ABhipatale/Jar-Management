<?php

namespace App\Services;

use App\Models\JarTransaction;
use App\Models\Reminder;
use App\Support\CurrentCompany;
use Illuminate\Support\Facades\Cache;

/**
 * Follow-up reminders for jars given (after 1 day, 1 week or 15 days).
 *
 * A reminder stays open only while the customer still holds jars or owes money:
 *  - the moment their account is clear (0 jars, ₹0 pending) every open reminder for them
 *    closes itself (checked after every jar entry / payment / edit / delete);
 *  - while not clear, a due reminder shows in the 🔔 screen and is pushed to the phone
 *    once a day (same notification tag, so it replaces yesterday's) until settled or done.
 */
class ReminderService
{
    public function __construct(
        private BalanceService $balances,
        private PushService $push,
    ) {}

    public function forGive(JarTransaction $tx, $days): void
    {
        $days = (int) $days;
        if ($tx->transaction_type !== JarTransaction::GIVEN || ! in_array($days, Reminder::DAYS, true)) {
            return;
        }
        Reminder::create([
            'customer_id' => $tx->customer_id,
            'jar_transaction_id' => $tx->id,
            'days' => $days,
            'remind_on' => $tx->transaction_date->copy()->addDays($days)->toDateString(),
        ]);
    }

    /** Entry date changed: move its open reminders with it. */
    public function reschedule(JarTransaction $tx): void
    {
        foreach (Reminder::where('jar_transaction_id', $tx->id)->where('status', 'pending')->get() as $r) {
            $r->update(['remind_on' => $tx->transaction_date->copy()->addDays($r->days)->toDateString(), 'pushed_at' => null]);
        }
    }

    public function removeFor(JarTransaction $tx): void
    {
        Reminder::where('jar_transaction_id', $tx->id)->delete();
    }

    /** Close every open reminder of a customer whose account is clear. Returns how many closed. */
    public function syncCustomer(int $customerId): int
    {
        if (! $this->settled($this->balances->forCustomer($customerId))) {
            return 0;
        }

        return Reminder::where('customer_id', $customerId)->where('status', 'pending')
            ->update(['status' => 'done', 'auto_done' => true, 'done_at' => now(), 'updated_at' => now()]);
    }

    private function settled(array $balance): bool
    {
        return $balance['current_jars'] <= 0 && $balance['pending'] <= 0.004;
    }

    /** Safety net: close reminders of any customer that became clear by other means. */
    private function syncAllOpen(): void
    {
        foreach (Reminder::where('status', 'pending')->distinct()->pluck('customer_id') as $cid) {
            $this->syncCustomer((int) $cid);
        }
    }

    /** Due (today or overdue), upcoming, and recently completed reminders. */
    public function list(): array
    {
        $this->syncAllOpen();
        $today = now()->toDateString();
        $with = ['customer:id,name,mobile', 'jarTransaction:id,transaction_date,jar_quantity'];

        $due = Reminder::with($with)->where('status', 'pending')->where('remind_on', '<=', $today)->orderBy('remind_on')->get();
        $upcoming = Reminder::with($with)->where('status', 'pending')->where('remind_on', '>', $today)->orderBy('remind_on')->limit(100)->get();
        $done = Reminder::with($with)->where('status', 'done')->orderByDesc('done_at')->limit(30)->get();

        return [
            'due' => $due->map(fn ($r) => $this->present($r))->all(),
            'upcoming' => $upcoming->map(fn ($r) => $this->present($r))->all(),
            'done' => $done->map(fn ($r) => $this->present($r))->all(),
        ];
    }

    /** Open due reminders: they keep counting until the customer is clear or marked done. */
    public function unreadCount(): int
    {
        return Reminder::where('status', 'pending')->where('remind_on', '<=', now()->toDateString())->count();
    }

    public function markAllRead(): void
    {
        Reminder::where('status', 'pending')->where('remind_on', '<=', now()->toDateString())->whereNull('read_at')->update(['read_at' => now()]);
    }

    public function complete(Reminder $r): void
    {
        $r->update(['status' => 'done', 'done_at' => now(), 'read_at' => $r->read_at ?? now()]);
    }

    /**
     * Process reminders that are due: auto-close settled customers, push the rest.
     * Safe to call often: each open reminder is pushed at most once per day (pushed_at).
     * $lazy = called from normal app use; then it runs at most once per day.
     *
     * @return array{closed:int, notified:int, devices:int}
     */
    public function runDue(bool $lazy = false): array
    {
        // Follow-up reminders go out from 9 AM (the early run is for bookings).
        if (now()->hour < 9) {
            return ['closed' => 0, 'notified' => 0, 'devices' => 0];
        }
        if ($lazy && ! Cache::add('reminders:ran:'.CurrentCompany::require().':'.now()->toDateString(), 1, now()->endOfDay())) {
            return ['closed' => 0, 'notified' => 0, 'devices' => 0];
        }

        $due = Reminder::with(['customer:id,name,mobile', 'jarTransaction:id,transaction_date,jar_quantity'])
            ->where('status', 'pending')->where('remind_on', '<=', now()->toDateString())
            ->where(fn ($q) => $q->whereNull('pushed_at')->orWhere('pushed_at', '<', now()->startOfDay()))
            ->get();

        $closed = 0;
        $toNotify = [];
        foreach ($due as $r) {
            $b = $this->balances->forCustomer($r->customer_id);
            if ($this->settled($b)) {
                $r->update(['status' => 'done', 'auto_done' => true, 'done_at' => now()]);
                $closed++;
            } else {
                $toNotify[] = [$r, $b];
            }
        }

        $devices = 0;
        if ($toNotify) {
            $devices = $this->push->sendToAll(fn (string $locale) => $this->pushPayload($toNotify, $locale));
            Reminder::whereIn('id', array_map(fn ($x) => $x[0]->id, $toNotify))->update(['pushed_at' => now()]);
        }

        return ['closed' => $closed, 'notified' => count($toNotify), 'devices' => $devices];
    }

    private function pushPayload(array $items, string $locale): array
    {
        if (count($items) === 1) {
            [$r, $b] = $items[0];

            return [
                'title' => __('🔔 :name – जार/उधारी आठवण', ['name' => $r->customer?->name], $locale),
                'body' => $this->line($r, $b, $locale),
                'url' => '/notifications',
                'tag' => 'reminder-'.$r->id,
            ];
        }

        $names = implode(', ', array_slice(array_map(fn ($x) => $x[0]->customer?->name, $items), 0, 5));

        return [
            'title' => __('🔔 आज :n आठवणी', ['n' => count($items)], $locale),
            'body' => $names.(count($items) > 5 ? '…' : ''),
            'url' => '/notifications',
            'tag' => 'reminders-'.now()->toDateString(),
        ];
    }

    private function line(Reminder $r, array $b, string $locale): string
    {
        return __(':date रोजी :qty जार दिले होते. सध्या :jars जार व ₹:pending बाकी.', [
            'date' => $r->jarTransaction?->transaction_date?->format('d/m/Y') ?? '',
            'qty' => $r->jarTransaction?->jar_quantity ?? '',
            'jars' => $b['current_jars'],
            'pending' => number_format(max($b['pending'], 0), 0),
        ], $locale);
    }

    private function present(Reminder $r): array
    {
        $b = $this->balances->forCustomer($r->customer_id);

        return [
            'id' => $r->id,
            'customer_id' => $r->customer_id,
            'customer_name' => $r->customer?->name,
            'customer_mobile' => $r->customer?->mobile,
            'days' => $r->days,
            'remind_on' => $r->remind_on->toDateString(),
            'given_on' => $r->jarTransaction?->transaction_date?->toDateString(),
            'jar_quantity' => $r->jarTransaction?->jar_quantity,
            'current_jars' => $b['current_jars'],
            'pending_amount' => $b['pending'],
            'status' => $r->status,
            'auto_done' => $r->auto_done,
            'read' => $r->read_at !== null,
        ];
    }
}
