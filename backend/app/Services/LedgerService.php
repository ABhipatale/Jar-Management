<?php

namespace App\Services;

use App\Models\CustomerLedger;
use App\Models\JarTransaction;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

/**
 * customer_ledger is a derived statement. After any entry, payment or delete we
 * rebuild the customer's rows (inside the caller's DB transaction), so running
 * balances stay correct even for back-dated entries and deletions.
 */
class LedgerService
{
    public function rebuild(int $customerId): void
    {
        $events = [];

        foreach (JarTransaction::where('customer_id', $customerId)->get() as $t) {
            $isGiven = $t->transaction_type === JarTransaction::GIVEN;
            $events[] = [
                'sort' => [$t->transaction_date->format('Y-m-d'), $t->created_at?->format('Y-m-d H:i:s'), 0, $t->id],
                'row' => [
                    'entry_date' => $t->transaction_date->format('Y-m-d'),
                    'entry_type' => $t->transaction_type,
                    'jar_transaction_id' => $t->id,
                    'payment_id' => null,
                    'jars_given' => $isGiven ? $t->jar_quantity : 0,
                    'jars_returned' => $isGiven ? 0 : $t->jar_quantity,
                    'amount' => $t->amount,
                    'paid' => round($t->paid_amount + $t->advance_amount, 2),
                    'udhari' => $t->udhari_amount,
                    'description' => $t->notes,
                ],
                'jars' => $isGiven ? $t->jar_quantity : -$t->jar_quantity,
                'due' => $t->udhari_amount - $t->advance_amount,
            ];
        }

        foreach (Payment::where('customer_id', $customerId)->get() as $p) {
            $events[] = [
                'sort' => [$p->payment_date->format('Y-m-d'), $p->created_at?->format('Y-m-d H:i:s'), 1, $p->id],
                'row' => [
                    'entry_date' => $p->payment_date->format('Y-m-d'),
                    'entry_type' => 'payment',
                    'jar_transaction_id' => null,
                    'payment_id' => $p->id,
                    'jars_given' => 0,
                    'jars_returned' => 0,
                    'amount' => 0,
                    'paid' => $p->amount,
                    'udhari' => 0,
                    'description' => strtoupper($p->payment_mode).($p->notes ? ' - '.$p->notes : ''),
                ],
                'jars' => 0,
                'due' => -$p->amount,
            ];
        }

        usort($events, fn ($a, $b) => $a['sort'] <=> $b['sort']);

        $now = now();
        $balance = 0.0;
        $jars = 0;
        $rows = [];
        foreach ($events as $e) {
            $balance = round($balance + $e['due'], 2);
            $jars += $e['jars'];
            $rows[] = $e['row'] + [
                'customer_id' => $customerId,
                'balance' => $balance,
                'jar_balance' => $jars,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('customer_ledger')->where('customer_id', $customerId)->delete();
        foreach (array_chunk($rows, 200) as $chunk) {
            CustomerLedger::insert($chunk);
        }
    }
}
