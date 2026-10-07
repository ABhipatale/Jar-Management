<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * All dashboard / report numbers. Every figure is summed from the database.
 *
 *   Cash collection = money received on jar entries (paid + advance) + CASH payments
 *   Udhari          = udhari generated on jar entries in the period
 *   Net cash        = cash collection - cash expenses
 */
class ReportService
{
    public function __construct(
        private BalanceService $balances,
        private JarService $jars,
    ) {}

    public function summary(string $from, string $to, ?int $customerId = null): array
    {
        $tx = DB::table('jar_transactions')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$from, $to])
            ->when($customerId, fn ($q) => $q->where('customer_id', $customerId))
            ->selectRaw("COALESCE(SUM(CASE WHEN transaction_type = 'given' THEN jar_quantity ELSE 0 END), 0) AS given")
            ->selectRaw("COALESCE(SUM(CASE WHEN transaction_type = 'returned' THEN jar_quantity ELSE 0 END), 0) AS returned")
            ->selectRaw('COALESCE(SUM(amount), 0) AS sales')
            ->selectRaw('COALESCE(SUM(paid_amount + advance_amount), 0) AS entry_cash')
            ->selectRaw('COALESCE(SUM(udhari_amount), 0) AS udhari')
            ->first();

        $pay = DB::table('payments')
            ->whereNull('deleted_at')
            ->whereBetween('payment_date', [$from, $to])
            ->when($customerId, fn ($q) => $q->where('customer_id', $customerId))
            ->selectRaw('COALESCE(SUM(amount), 0) AS total')
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END), 0) AS cash")
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_mode = 'upi' THEN amount ELSE 0 END), 0) AS upi")
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_mode = 'bank' THEN amount ELSE 0 END), 0) AS bank")
            ->first();

        $exp = $customerId ? null : DB::table('expenses')
            ->whereNull('deleted_at')
            ->whereBetween('expense_date', [$from, $to])
            ->selectRaw('COALESCE(SUM(amount), 0) AS total')
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END), 0) AS cash")
            ->first();

        $jarStatus = DB::table('jars')
            ->whereIn('status', ['damaged', 'lost'])
            ->whereBetween('status_date', [$from, $to])
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END), 0) AS damaged")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END), 0) AS lost")
            ->first();

        $cash = round((float) $tx->entry_cash + (float) $pay->cash, 2);
        $expenses = round((float) ($exp->total ?? 0), 2);
        $cashExpenses = round((float) ($exp->cash ?? 0), 2);

        return [
            'from' => $from,
            'to' => $to,
            'given' => (int) $tx->given,
            'returned' => (int) $tx->returned,
            'net_jars' => (int) $tx->given - (int) $tx->returned,
            'sales' => round((float) $tx->sales, 2),
            'entry_cash' => round((float) $tx->entry_cash, 2),
            'udhari' => round((float) $tx->udhari, 2),
            'payments' => round((float) $pay->total, 2),
            'payments_cash' => round((float) $pay->cash, 2),
            'payments_upi' => round((float) $pay->upi, 2),
            'payments_bank' => round((float) $pay->bank, 2),
            'cash' => $cash,
            'expenses' => $expenses,
            'net_cash' => round($cash - $cashExpenses, 2),
            'pending' => $this->balances->totalPending($customerId),
            'damaged' => (int) $jarStatus->damaged,
            'lost' => (int) $jarStatus->lost,
        ];
    }

    /**
     * One row per customer with activity in the period (or the chosen customer),
     * plus their all-time current jars and pending.
     */
    public function customerWise(string $from, string $to, ?int $customerId = null, ?string $search = null): array
    {
        $tx = DB::table('jar_transactions')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$from, $to])
            ->select('customer_id')
            ->selectRaw("SUM(CASE WHEN transaction_type = 'given' THEN jar_quantity ELSE 0 END) AS given")
            ->selectRaw("SUM(CASE WHEN transaction_type = 'returned' THEN jar_quantity ELSE 0 END) AS returned")
            ->selectRaw('SUM(amount) AS amount')
            ->selectRaw('SUM(paid_amount + advance_amount) AS paid')
            ->selectRaw('SUM(udhari_amount) AS udhari')
            ->groupBy('customer_id');

        $pay = DB::table('payments')
            ->whereNull('deleted_at')
            ->whereBetween('payment_date', [$from, $to])
            ->select('customer_id')
            ->selectRaw('SUM(amount) AS payments')
            ->groupBy('customer_id');

        $q = $this->balances->balancesTable()
            ->leftJoinSub($tx, 'rt', 'rt.customer_id', '=', 'b.id')
            ->leftJoinSub($pay, 'rp', 'rp.customer_id', '=', 'b.id')
            ->select('b.id', 'b.name', 'b.mobile', 'b.current_jars', 'b.pending_amount')
            ->selectRaw('COALESCE(rt.given, 0) AS given')
            ->selectRaw('COALESCE(rt.returned, 0) AS returned')
            ->selectRaw('COALESCE(rt.amount, 0) AS amount')
            ->selectRaw('COALESCE(rt.paid, 0) AS paid')
            ->selectRaw('COALESCE(rt.udhari, 0) AS udhari')
            ->selectRaw('COALESCE(rp.payments, 0) AS payments')
            ->orderBy('b.name');

        if ($customerId) {
            $q->where('b.id', $customerId);
        } else {
            $q->where(fn ($w) => $w->whereNotNull('rt.customer_id')->orWhereNotNull('rp.customer_id'));
        }
        $this->applySearch($q, $search, 'b');

        return $q->get()->map(fn ($r) => [
            'customer_id' => (int) $r->id,
            'name' => $r->name,
            'mobile' => $r->mobile,
            'given' => (int) $r->given,
            'returned' => (int) $r->returned,
            'net_jars' => (int) $r->given - (int) $r->returned,
            'amount' => round((float) $r->amount, 2),
            'paid' => round((float) $r->paid, 2),
            'udhari' => round((float) $r->udhari, 2),
            'payments' => round((float) $r->payments, 2),
            'current_jars' => (int) $r->current_jars,
            'pending_amount' => round((float) $r->pending_amount, 2),
        ])->all();
    }

    /**
     * Daily figures for charts: jars given/returned, cash collected, udhari created, payments.
     * Every day in the range is present (zeros included).
     */
    public function dailySeries(string $from, string $to): array
    {
        $tx = DB::table('jar_transactions')->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$from, $to])
            ->groupBy('transaction_date')
            ->selectRaw('transaction_date AS d')
            ->selectRaw("SUM(CASE WHEN transaction_type = 'given' THEN jar_quantity ELSE 0 END) AS given")
            ->selectRaw("SUM(CASE WHEN transaction_type = 'returned' THEN jar_quantity ELSE 0 END) AS returned")
            ->selectRaw('SUM(paid_amount + advance_amount) AS entry_cash')
            ->selectRaw('SUM(udhari_amount) AS udhari')
            ->get()->keyBy(fn ($r) => substr((string) $r->d, 0, 10));

        $pay = DB::table('payments')->whereNull('deleted_at')
            ->whereBetween('payment_date', [$from, $to])
            ->groupBy('payment_date')
            ->selectRaw('payment_date AS d')
            ->selectRaw('SUM(amount) AS total')
            ->selectRaw("SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END) AS cash")
            ->get()->keyBy(fn ($r) => substr((string) $r->d, 0, 10));

        $rows = [];
        foreach (CarbonPeriod::create($from, $to) as $day) {
            $d = $day->toDateString();
            $t = $tx[$d] ?? null;
            $p = $pay[$d] ?? null;
            $rows[] = [
                'date' => $d,
                'given' => (int) ($t->given ?? 0),
                'returned' => (int) ($t->returned ?? 0),
                'cash' => round((float) ($t->entry_cash ?? 0) + (float) ($p->cash ?? 0), 2),
                'udhari' => round((float) ($t->udhari ?? 0), 2),
                'payments' => round((float) ($p->total ?? 0), 2),
            ];
        }

        return $rows;
    }

    /** Day-by-day cash book for the period. */
    public function cashBook(string $from, string $to): array
    {
        $entries = DB::table('jar_transactions')->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$from, $to])
            ->groupBy('transaction_date')
            ->selectRaw('transaction_date AS d, SUM(paid_amount + advance_amount) AS v')
            ->pluck('v', 'd');

        $pays = DB::table('payments')->whereNull('deleted_at')
            ->whereBetween('payment_date', [$from, $to])
            ->groupBy('payment_date', 'payment_mode')
            ->selectRaw('payment_date AS d, payment_mode AS m, SUM(amount) AS v')
            ->get();

        $exps = DB::table('expenses')->whereNull('deleted_at')
            ->whereBetween('expense_date', [$from, $to])
            ->where('payment_mode', 'cash')
            ->groupBy('expense_date')
            ->selectRaw('expense_date AS d, SUM(amount) AS v')
            ->pluck('v', 'd');

        $rows = [];
        foreach (CarbonPeriod::create($from, $to) as $day) {
            $d = $day->toDateString();
            $p = $pays->filter(fn ($r) => substr((string) $r->d, 0, 10) === $d);
            $entry = (float) ($this->pick($entries, $d));
            $cashPay = (float) $p->where('m', 'cash')->sum('v');
            $upi = (float) $p->where('m', 'upi')->sum('v');
            $bank = (float) $p->where('m', 'bank')->sum('v');
            $exp = (float) ($this->pick($exps, $d));
            if ($entry == 0 && $cashPay == 0 && $upi == 0 && $bank == 0 && $exp == 0) {
                continue;
            }
            $rows[] = [
                'date' => $d,
                'entry_cash' => round($entry, 2),
                'payments_cash' => round($cashPay, 2),
                'cash' => round($entry + $cashPay, 2),
                'upi' => round($upi, 2),
                'bank' => round($bank, 2),
                'expenses' => round($exp, 2),
                'net_cash' => round($entry + $cashPay - $exp, 2),
            ];
        }

        return array_reverse($rows);
    }

    /** Customers who owe money, biggest first. */
    public function pending(?string $search = null, ?int $customerId = null): array
    {
        $q = $this->balances->balancesTable()
            ->where('pending_amount', '>', 0)
            ->when($customerId, fn ($w) => $w->where('id', $customerId))
            ->orderByDesc('pending_amount');
        $this->applySearch($q, $search);

        return $q->get()->map(fn ($r) => [
            'customer_id' => (int) $r->id,
            'name' => $r->name,
            'mobile' => $r->mobile,
            'current_jars' => (int) $r->current_jars,
            'pending_amount' => round((float) $r->pending_amount, 2),
            'last_payment_date' => $r->last_payment_date ? substr((string) $r->last_payment_date, 0, 10) : null,
        ])->all();
    }

    /** Stock summary + who is holding jars. */
    public function jarStatus(?string $search = null, ?int $customerId = null): array
    {
        $q = $this->balances->balancesTable()
            ->where('current_jars', '>', 0)
            ->when($customerId, fn ($w) => $w->where('id', $customerId))
            ->orderByDesc('current_jars');
        $this->applySearch($q, $search);

        return [
            'summary' => $this->jars->summary(),
            'customers' => $q->get()->map(fn ($r) => [
                'customer_id' => (int) $r->id,
                'name' => $r->name,
                'mobile' => $r->mobile,
                'current_jars' => (int) $r->current_jars,
                'pending_amount' => round((float) $r->pending_amount, 2),
            ])->all(),
        ];
    }

    /** Works on PostgreSQL and SQLite (no ILIKE). */
    public function applySearch(Builder $q, ?string $search, ?string $alias = null): void
    {
        $search = trim((string) $search);
        if ($search === '') {
            return;
        }
        $p = $alias ? $alias.'.' : '';
        $like = '%'.mb_strtolower($search).'%';
        $q->where(fn ($w) => $w->whereRaw("LOWER({$p}name) LIKE ?", [$like])->orWhere("{$p}mobile", 'like', '%'.$search.'%'));
    }

    public static function weekRange(?string $date): array
    {
        $d = CarbonImmutable::parse($date ?: 'today');

        return [$d->startOfWeek()->toDateString(), $d->endOfWeek()->toDateString()];
    }

    public static function monthRange(?string $month): array
    {
        $d = CarbonImmutable::parse(($month ?: now()->format('Y-m')).'-01');

        return [$d->startOfMonth()->toDateString(), $d->endOfMonth()->toDateString()];
    }

    private function pick($map, string $d)
    {
        foreach ($map as $k => $v) {
            if (substr((string) $k, 0, 10) === $d) {
                return $v;
            }
        }

        return 0;
    }
}
