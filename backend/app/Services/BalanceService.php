<?php

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Single source of truth for customer balances. Nothing is cached on the
 * customer row — every number is summed from jar_transactions and payments:
 *
 *   current_jars   = SUM(given) - SUM(returned)
 *   pending_amount = SUM(udhari) - SUM(advance) - SUM(payments)
 *
 * A negative pending_amount means the customer has paid in advance.
 */
class BalanceService
{
    private function txTotals(): Builder
    {
        return DB::table('jar_transactions')
            ->whereNull('deleted_at')
            ->select('customer_id')
            ->selectRaw("SUM(CASE WHEN transaction_type = 'given' THEN jar_quantity ELSE 0 END) AS given")
            ->selectRaw("SUM(CASE WHEN transaction_type = 'returned' THEN jar_quantity ELSE 0 END) AS returned")
            ->selectRaw('SUM(udhari_amount) AS udhari')
            ->selectRaw('SUM(advance_amount) AS advance')
            ->groupBy('customer_id');
    }

    private function paymentTotals(): Builder
    {
        return DB::table('payments')
            ->whereNull('deleted_at')
            ->select('customer_id')
            ->selectRaw('SUM(amount) AS paid')
            ->selectRaw('MAX(payment_date) AS last_payment_date')
            ->groupBy('customer_id');
    }

    /** customers (not deleted) + current_jars + pending_amount. Alias: c */
    public function customersQuery(): Builder
    {
        return DB::table('customers as c')
            ->leftJoinSub($this->txTotals(), 't', 't.customer_id', '=', 'c.id')
            ->leftJoinSub($this->paymentTotals(), 'p', 'p.customer_id', '=', 'c.id')
            ->whereNull('c.deleted_at')
            ->select('c.id', 'c.name', 'c.mobile', 'c.address', 'c.status', 'c.created_at', 'p.last_payment_date')
            ->selectRaw('COALESCE(t.given, 0) - COALESCE(t.returned, 0) AS current_jars')
            ->selectRaw('COALESCE(t.udhari, 0) - COALESCE(t.advance, 0) - COALESCE(p.paid, 0) AS pending_amount');
    }

    /** Wraps customersQuery so computed columns can be used in WHERE (SQL can't filter on SELECT aliases). */
    public function balancesTable(): Builder
    {
        return DB::query()->fromSub($this->customersQuery(), 'b');
    }

    /** @return array{current_jars:int, pending:float} */
    public function forCustomer(int $customerId): array
    {
        $t = DB::table('jar_transactions')
            ->whereNull('deleted_at')
            ->where('customer_id', $customerId)
            ->selectRaw("COALESCE(SUM(CASE WHEN transaction_type = 'given' THEN jar_quantity ELSE -jar_quantity END), 0) AS jars")
            ->selectRaw('COALESCE(SUM(udhari_amount), 0) - COALESCE(SUM(advance_amount), 0) AS due')
            ->first();

        $paid = DB::table('payments')
            ->whereNull('deleted_at')
            ->where('customer_id', $customerId)
            ->sum('amount');

        return [
            'current_jars' => (int) $t->jars,
            'pending' => round((float) $t->due - (float) $paid, 2),
        ];
    }

    /** Jars currently out with all (non-deleted) customers. */
    public function totalCustomerJars(): int
    {
        return (int) DB::table('jar_transactions as j')
            ->join('customers as c', 'c.id', '=', 'j.customer_id')
            ->whereNull('j.deleted_at')
            ->whereNull('c.deleted_at')
            ->selectRaw("COALESCE(SUM(CASE WHEN j.transaction_type = 'given' THEN j.jar_quantity ELSE -j.jar_quantity END), 0) AS jars")
            ->value('jars');
    }

    /** Sum of positive pending balances (advances are not netted against other customers' dues). */
    public function totalPending(?int $customerId = null): float
    {
        $q = $this->balancesTable()->where('pending_amount', '>', 0);
        if ($customerId) {
            $q->where('id', $customerId);
        }

        return round((float) $q->sum('pending_amount'), 2);
    }
}
