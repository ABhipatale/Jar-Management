<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\JarTransaction;
use App\Models\RouteStop;
use App\Support\CurrentCompany;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Daily delivery routes (morning / evening).
 *
 * Who is due is worked out live from each customer's schedule and LAST DELIVERY (their last
 * "jars given" entry) — no cron job. Nothing is saved until the owner presses Start: then
 * that day's route is stored as route_stops (unique per customer, date and session, so a
 * refresh or a second tap never duplicates it). Delivering a stop is the normal jar entry
 * (JarTransactionService marks the stop done in the same DB transaction), so stock, udhari,
 * the statement, bills and reports work exactly as for any other entry.
 *
 *   daily     every day
 *   every     every N days after the last delivery (missed → stays due, shown as overdue)
 *   weekdays  on the chosen weekdays only (ISO 1 = Monday … 7 = Sunday)
 *   booked    never automatically — add to a route by hand when the customer asks
 */
class RouteService
{
    public const SKIP_REASONS = ['not_home', 'postponed', 'not_needed', 'cancelled', 'other'];

    public function __construct(private BalanceService $balances) {}

    public static function today(): string
    {
        return now()->toDateString();
    }

    /** Both sessions for the delivery home screen: progress and totals. */
    public function summary(string $date): array
    {
        $out = [];
        foreach (RouteStop::SESSIONS as $session) {
            $out[$session] = $this->totals($this->stops($session, $date));
        }

        return ['date' => $date, 'sessions' => $out];
    }

    /** One route: the saved stops once started, otherwise today's due customers (a preview). */
    public function view(string $session, string $date): array
    {
        $stops = $this->stops($session, $date);

        return [
            'date' => $date,
            'session' => $session,
            'started' => $stops['started'],
            'stops' => $stops['rows'],
            'totals' => $this->totals($stops),
        ];
    }

    /** Save the route (idempotent: an already started route is left as it is). */
    public function start(string $session, string $date): void
    {
        DB::transaction(function () use ($session, $date) {
            if ($this->started($session, $date)) {
                return;
            }
            $now = now();
            $companyId = CurrentCompany::require();
            $rows = [];
            foreach ($this->due($session, $date) as $i => $c) {
                $rows[] = [
                    'company_id' => $companyId,
                    'route_date' => $date,
                    'session' => $session,
                    'customer_id' => $c->id,
                    'position' => $i + 1,
                    'quantity' => max(1, (int) $c->{$session.'_qty'}),
                    'status' => RouteStop::PENDING,
                    'added_manually' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            // Unique (company, date, session, customer): a double tap can't make two routes.
            foreach (array_chunk($rows, 200) as $chunk) {
                RouteStop::insertOrIgnore($chunk);
            }
        });
    }

    /** Add a customer to today's route by hand (also customers who aren't due or on no route). */
    public function add(string $session, string $date, int $customerId, ?int $qty): RouteStop
    {
        return DB::transaction(function () use ($session, $date, $customerId, $qty) {
            $customer = Customer::findOrFail($customerId);
            $this->start($session, $date); // adding to a route that isn't started yet starts it
            $existing = RouteStop::where(['route_date' => $date, 'session' => $session, 'customer_id' => $customer->id])->first();
            if ($existing) {
                throw ValidationException::withMessages(['customer_id' => __('हा ग्राहक आजच्या या फेरीत आधीच आहे.')]);
            }

            return RouteStop::create([
                'route_date' => $date,
                'session' => $session,
                'customer_id' => $customer->id,
                'position' => (int) RouteStop::where(['route_date' => $date, 'session' => $session])->max('position') + 1,
                'quantity' => $qty ?: max(1, (int) $customer->{$session.'_qty'}),
                'added_manually' => true,
            ]);
        });
    }

    /** Skip (with a reason), bring back, or change today's jars — never touches a delivered stop. */
    public function update(RouteStop $stop, array $data): RouteStop
    {
        if ($stop->status === RouteStop::DONE && (isset($data['status']) || isset($data['quantity']))) {
            throw ValidationException::withMessages(['status' => __('या ग्राहकाची डिलिव्हरी झाली आहे. बदल करायचा असेल तर ती नोंद बदला किंवा हटवा.')]);
        }
        if (($data['status'] ?? null) === RouteStop::SKIPPED) {
            $stop->fill(['status' => RouteStop::SKIPPED, 'skip_reason' => $data['skip_reason'] ?? 'other']);
        } elseif (($data['status'] ?? null) === RouteStop::PENDING) {
            $stop->fill(['status' => RouteStop::PENDING, 'skip_reason' => null]);
        }
        if (isset($data['quantity'])) {
            $stop->quantity = (int) $data['quantity'];
        }
        $stop->save();

        return $stop;
    }

    /** Take a customer off today's route (delivered stops stay: delete the entry instead). */
    public function remove(RouteStop $stop): void
    {
        if ($stop->status === RouteStop::DONE) {
            throw ValidationException::withMessages(['stop' => __('या ग्राहकाची डिलिव्हरी झाली आहे. आधी ती नोंद हटवा.')]);
        }
        $stop->delete();
    }

    /**
     * New order for today's route. With $permanent the customers keep this order on future
     * routes too; otherwise only today changes.
     */
    public function reorder(string $session, string $date, array $stopIds, bool $permanent): void
    {
        DB::transaction(function () use ($session, $date, $stopIds, $permanent) {
            $stops = RouteStop::where(['route_date' => $date, 'session' => $session])->get()->keyBy('id');
            $pos = 0;
            foreach ($stopIds as $id) {
                if (! $stop = $stops->get((int) $id)) {
                    continue;
                }
                $stop->update(['position' => ++$pos]);
                if ($permanent) {
                    Customer::whereKey($stop->customer_id)->update([$session.'_order' => $pos]);
                }
            }
        });
    }

    // ── Who is due ──

    /** Customers on this session's route who are due on $date, in route order. */
    public function due(string $session, string $date): Collection
    {
        $day = CarbonImmutable::parse($date);
        $customers = $this->balances->balancesTable()
            ->where('route_'.$session, true)
            ->where('status', 'active')
            ->get();
        $last = $this->lastDeliveries($customers->pluck('id')->all(), $date);

        return $customers
            ->map(function ($c) use ($day, $last) {
                $c->last_delivery = $last[$c->id] ?? null;
                $c->overdue_days = 0;
                switch ($c->schedule_type) {
                    case 'every':
                        if ($c->last_delivery) {
                            $gap = (int) CarbonImmutable::parse($c->last_delivery)->diffInDays($day);
                            $every = max(2, (int) $c->schedule_every);
                            if ($gap < $every) {
                                return null;
                            }
                            $c->overdue_days = $gap - $every;
                        }
                        break;
                    case 'weekdays':
                        $days = array_filter(array_map('intval', explode(',', (string) $c->schedule_days)));
                        if (! in_array($day->dayOfWeekIso, $days, true)) {
                            return null;
                        }
                        break;
                    case 'booked':
                        return null;
                }

                return $c;
            })
            ->filter()
            // The session's saved order first; customers without one at the end, by name.
            ->sortBy(fn ($c) => [$c->{$session.'_order'} ?? PHP_INT_MAX, mb_strtolower($c->name)])
            ->values();
    }

    /** customer_id => date of their last "jars given" entry on or before $date. */
    private function lastDeliveries(array $ids, string $date): array
    {
        if (! $ids) {
            return [];
        }

        return CurrentCompany::table('jar_transactions')->whereNull('deleted_at')
            ->whereIn('customer_id', $ids)
            ->where('transaction_type', JarTransaction::GIVEN)
            ->where('transaction_date', '<=', $date)
            ->groupBy('customer_id')
            ->selectRaw('customer_id, MAX(transaction_date) AS d')
            ->pluck('d', 'customer_id')
            ->map(fn ($d) => substr((string) $d, 0, 10))
            ->all();
    }

    private function started(string $session, string $date): bool
    {
        return RouteStop::where(['route_date' => $date, 'session' => $session])->exists();
    }

    // ── Rows for the screen ──

    /** @return array{started: bool, rows: array} */
    private function stops(string $session, string $date): array
    {
        $saved = RouteStop::where(['route_date' => $date, 'session' => $session])->orderBy('position')->orderBy('id')->get();
        if ($saved->isEmpty()) {
            $due = $this->due($session, $date);

            return ['started' => false, 'rows' => $due->map(fn ($c, $i) => $this->row(null, $c, $session, $i + 1))->all()];
        }

        $customers = $this->balances->balancesTable()->whereIn('id', $saved->pluck('customer_id'))->get()->keyBy('id');
        $last = $this->lastDeliveries($saved->pluck('customer_id')->all(), $date);
        $done = $this->deliveries($saved->whereNotNull('jar_transaction_id')->pluck('jar_transaction_id')->all());

        $rows = [];
        foreach ($saved as $stop) {
            if (! $c = $customers->get($stop->customer_id)) {
                continue; // customer deleted since
            }
            $c->last_delivery = $last[$c->id] ?? null;
            $c->overdue_days = 0;
            $rows[] = $this->row($stop, $c, $session, count($rows) + 1, $done[$stop->jar_transaction_id] ?? null);
        }

        return ['started' => true, 'rows' => $rows];
    }

    private function row(?RouteStop $stop, object $c, string $session, int $number, ?array $delivered = null): array
    {
        return [
            'id' => $stop?->id,
            'number' => $number,
            'customer_id' => (int) $c->id,
            'name' => $c->name,
            'mobile' => $c->mobile,
            'address' => $c->address,
            'note' => $c->delivery_note,
            'quantity' => $stop ? $stop->quantity : max(1, (int) $c->{$session.'_qty'}),
            'status' => $stop ? $stop->status : RouteStop::PENDING,
            'skip_reason' => $stop?->skip_reason,
            'added_manually' => (bool) $stop?->added_manually,
            'jar_transaction_id' => $stop?->jar_transaction_id,
            'done_at' => $stop?->done_at?->format('H:i'),
            'delivered' => $delivered,
            'overdue_days' => (int) ($c->overdue_days ?? 0),
            'last_delivery' => $c->last_delivery ?? null,
            'schedule_type' => $c->schedule_type,
            'schedule_every' => (int) $c->schedule_every,
            'schedule_days' => $c->schedule_days,
            'current_jars' => (int) $c->current_jars,
            'current_bottles' => (int) $c->current_bottles,
            'pending_amount' => round((float) $c->pending_amount, 2),
        ];
    }

    /**
     * What each delivered stop's entry gave and took back. One save can make several rows
     * (jar + bottle, empties taken back): they share the customer, date and save time.
     *
     * @return array<int, array{jars:int, bottles:int, empties:int, amount:float, paid:float, udhari:float}>
     */
    private function deliveries(array $txIds): array
    {
        if (! $txIds) {
            return [];
        }
        $out = [];
        foreach (JarTransaction::whereIn('id', $txIds)->get() as $main) {
            $rows = JarTransaction::where('customer_id', $main->customer_id)
                ->whereDate('transaction_date', $main->transaction_date)
                ->where('created_at', $main->created_at)
                ->get();
            $given = $rows->where('transaction_type', JarTransaction::GIVEN);
            $out[$main->id] = [
                'jars' => (int) $given->where('product', 'jar')->sum('jar_quantity'),
                'bottles' => (int) $given->where('product', 'bottle')->sum('jar_quantity'),
                'empties' => (int) $rows->where('transaction_type', JarTransaction::RETURNED)->sum('jar_quantity'),
                'amount' => round((float) $given->sum('amount'), 2),
                'paid' => round((float) $rows->sum(fn ($r) => $r->paid_amount + $r->advance_amount), 2),
                'udhari' => round((float) $rows->sum('udhari_amount'), 2),
            ];
        }

        return $out;
    }

    private function totals(array $stops): array
    {
        $rows = collect($stops['rows']);
        $done = $rows->where('status', RouteStop::DONE);
        $d = $done->pluck('delivered')->filter();

        return [
            'started' => $stops['started'],
            'total' => $rows->count(),
            'done' => $done->count(),
            'skipped' => $rows->where('status', RouteStop::SKIPPED)->count(),
            'pending' => $rows->where('status', RouteStop::PENDING)->count(),
            'jars_planned' => (int) $rows->where('status', '!=', RouteStop::SKIPPED)->sum('quantity'),
            'jars_delivered' => (int) $d->sum('jars'),
            'bottles_delivered' => (int) $d->sum('bottles'),
            'empties' => (int) $d->sum('empties'),
            'amount' => round((float) $d->sum('amount'), 2),
            'cash' => round((float) $d->sum('paid'), 2),
            'udhari' => round((float) $d->sum('udhari'), 2),
            // For the route cards: one status per stop (progress segments) and who is next.
            'statuses' => $rows->pluck('status')->values()->all(),
            'next' => $rows->where('status', RouteStop::PENDING)->take(3)->pluck('name')->values()->all(),
        ];
    }
}
