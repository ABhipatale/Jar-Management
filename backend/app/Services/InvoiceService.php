<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Invoice;
use App\Support\CurrentCompany;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Invoice numbers like B-2026-00094: "B", the year, and a running number that starts again at
 * 00001 every year, separately for each shop. A bill is identified by a key (customer + period for
 * a customer bill; the draft + customer for a manual bill), so the same bill always has one number.
 */
class InvoiceService
{
    public const PREFIX = 'B';

    /** @param array{customer_id?:int|null, from?:string, to?:string, draft_id?:string, name?:string, mobile?:string} $d */
    public function keyFor(array $d): string
    {
        if (! empty($d['customer_id'])) {
            return 'c:'.$d['customer_id'].':'.$d['from'].':'.$d['to'];
        }

        // A manual bill: same draft and same customer = same number; another customer = a new bill.
        $who = mb_strtolower(trim((string) ($d['name'] ?? ''))).'|'.preg_replace('/\D/', '', (string) ($d['mobile'] ?? ''));

        return 'm:'.$d['draft_id'].':'.sha1($who);
    }

    public function format(int $year, int $seq): string
    {
        return sprintf('%s-%d-%05d', self::PREFIX, $year, $seq);
    }

    /** The number this bill has, or will get. Reserves nothing. */
    public function peek(string $key): array
    {
        if ($existing = Invoice::where('key', $key)->first()) {
            return ['number' => $existing->number, 'issued' => true];
        }
        $year = now()->year;

        return ['number' => $this->format($year, (int) Invoice::where('year', $year)->max('seq') + 1), 'issued' => false];
    }

    /** The number of this bill: its existing one, or the next running number (reserved now). */
    public function issue(string $key, ?int $customerId = null, ?string $from = null, ?string $to = null): Invoice
    {
        try {
            return DB::transaction(function () use ($key, $customerId, $from, $to) {
                // One number at a time per shop, so two phones never get the same one.
                Company::whereKey(CurrentCompany::require())->lockForUpdate()->first();

                if ($existing = Invoice::where('key', $key)->first()) {
                    return $existing;
                }
                $year = now()->year;
                $seq = (int) Invoice::where('year', $year)->max('seq') + 1;

                return Invoice::create([
                    'customer_id' => $customerId, 'year' => $year, 'seq' => $seq, 'number' => $this->format($year, $seq),
                    'key' => $key, 'period_from' => $from, 'period_to' => $to,
                ]);
            });
        } catch (UniqueConstraintViolationException $e) {
            // The same bill was issued at the same moment from another phone: use that number.
            return Invoice::where('key', $key)->firstOrFail();
        }
    }
}
