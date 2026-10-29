<?php

namespace App\Services;

use App\Support\CurrentCompany;
use App\Support\Products;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Single source of truth for customer balances. Nothing is cached on the
 * customer row — every number is summed from jar_transactions and payments:
 *
 *   current_jars    = SUM(jars given) - SUM(jars returned)        (30 L jars only)
 *   current_bottles = SUM(bottles given) - SUM(bottles returned)
 *   pending_amount  = SUM(udhari) - SUM(advance) - SUM(payments)
 *   deposit_held    = SUM(deposit on gives) - SUM(deposit refunded on returns)
 *
 * Jars and bottles are never added together. A negative pending_amount means the
 * customer has paid in advance. Deposit is the customer's money and never in pending.
 */
class BalanceService
{
    private function txTotals(): Builder
    {
        return CurrentCompany::table('jar_transactions')
            ->whereNull('deleted_at')
            ->select('customer_id')
            ->selectRaw(self::held('jar').' AS jars')
            ->selectRaw(self::held('bottle').' AS bottles')
            ->selectRaw(self::deposit('jar').' AS jar_deposit')
            ->selectRaw(self::deposit('bottle').' AS bottle_deposit')
            ->selectRaw('SUM(udhari_amount) AS udhari')
            ->selectRaw('SUM(advance_amount) AS advance')
            ->groupBy('customer_id');
    }

    /** SQL: net items of one product the customer holds. */
    private static function held(string $product, string $p = ''): string
    {
        return "SUM(CASE WHEN {$p}product = '{$product}' THEN (CASE WHEN {$p}transaction_type = 'given' THEN {$p}jar_quantity ELSE -{$p}jar_quantity END) ELSE 0 END)";
    }

    /** SQL: net deposit held for one product. */
    private static function deposit(string $product): string
    {
        return "SUM(CASE WHEN product = '{$product}' THEN (CASE WHEN transaction_type = 'given' THEN deposit_amount ELSE -deposit_amount END) ELSE 0 END)";
    }

    private function paymentTotals(): Builder
    {
        return CurrentCompany::table('payments')
            ->whereNull('deleted_at')
            ->select('customer_id')
            ->selectRaw('SUM(amount) AS paid')
            ->selectRaw('MAX(payment_date) AS last_payment_date')
            ->groupBy('customer_id');
    }

    /** customers (not deleted) + current_jars / current_bottles + pending_amount + deposit_held. Alias: c */
    public function customersQuery(): Builder
    {
        return CurrentCompany::table('customers as c')
            ->leftJoinSub($this->txTotals(), 't', 't.customer_id', '=', 'c.id')
            ->leftJoinSub($this->paymentTotals(), 'p', 'p.customer_id', '=', 'c.id')
            ->whereNull('c.deleted_at')
            ->select('c.id', 'c.name', 'c.mobile', 'c.address', 'c.status', 'c.created_at', 'p.last_payment_date')
            ->addSelect('c.takes_jar', 'c.takes_bottle', 'c.jar_rate', 'c.bottle_rate', 'c.no_deposit')
            ->selectRaw('COALESCE(t.jars, 0) AS current_jars')
            ->selectRaw('COALESCE(t.bottles, 0) AS current_bottles')
            ->selectRaw('COALESCE(t.jar_deposit, 0) AS jar_deposit_held')
            ->selectRaw('COALESCE(t.bottle_deposit, 0) AS bottle_deposit_held')
            ->selectRaw('COALESCE(t.jar_deposit, 0) + COALESCE(t.bottle_deposit, 0) AS deposit_held')
            ->selectRaw('COALESCE(t.udhari, 0) - COALESCE(t.advance, 0) - COALESCE(p.paid, 0) AS pending_amount');
    }

    /** Wraps customersQuery so computed columns can be used in WHERE (SQL can't filter on SELECT aliases). */
    public function balancesTable(): Builder
    {
        return DB::query()->fromSub($this->customersQuery(), 'b');
    }

    /**
     * held / deposits are keyed by product ('jar', 'bottle').
     *
     * @return array{current_jars:int, current_bottles:int, pending:float, deposit_held:float, held:array<string,int>, deposits:array<string,float>}
     */
    public function forCustomer(int $customerId): array
    {
        $t = CurrentCompany::table('jar_transactions')
            ->whereNull('deleted_at')
            ->where('customer_id', $customerId)
            ->selectRaw('COALESCE('.self::held('jar').', 0) AS jars')
            ->selectRaw('COALESCE('.self::held('bottle').', 0) AS bottles')
            ->selectRaw('COALESCE('.self::deposit('jar').', 0) AS jar_deposit')
            ->selectRaw('COALESCE('.self::deposit('bottle').', 0) AS bottle_deposit')
            ->selectRaw('COALESCE(SUM(udhari_amount), 0) - COALESCE(SUM(advance_amount), 0) AS due')
            ->first();

        $paid = CurrentCompany::table('payments')
            ->whereNull('deleted_at')
            ->where('customer_id', $customerId)
            ->sum('amount');

        $held = [Products::JAR => (int) $t->jars, Products::BOTTLE => (int) $t->bottles];
        $deposits = [Products::JAR => round((float) $t->jar_deposit, 2), Products::BOTTLE => round((float) $t->bottle_deposit, 2)];

        return [
            'current_jars' => $held[Products::JAR],
            'current_bottles' => $held[Products::BOTTLE],
            'pending' => round((float) $t->due - (float) $paid, 2),
            'deposit_held' => round(array_sum($deposits), 2),
            'held' => $held,
            'deposits' => $deposits,
        ];
    }

    /** Items of one product currently out with all (non-deleted) customers. */
    public function totalCustomerJars(string $product = Products::JAR): int
    {
        return (int) CurrentCompany::table('jar_transactions as j')
            ->join('customers as c', 'c.id', '=', 'j.customer_id')
            ->whereNull('j.deleted_at')
            ->whereNull('c.deleted_at')
            ->selectRaw('COALESCE('.self::held($product, 'j.').', 0) AS jars')
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
