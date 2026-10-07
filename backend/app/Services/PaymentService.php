<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Payment;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentService
{
    public function __construct(
        private BalanceService $balances,
        private LedgerService $ledger,
        private ReminderService $reminders,
    ) {}

    /** @return array{0: Payment, 1: bool} */
    public function create(array $data, ?int $userId): array
    {
        if (! empty($data['client_uuid']) && $existing = Payment::where('client_uuid', $data['client_uuid'])->first()) {
            return [$existing, false];
        }

        try {
            return DB::transaction(function () use ($data, $userId) {
                Customer::whereKey($data['customer_id'])->lockForUpdate()->firstOrFail();

                $pending = $this->balances->forCustomer($data['customer_id'])['pending'];
                $amount = round((float) $data['amount'], 2);
                $isAdvance = (bool) ($data['is_advance'] ?? false);

                if ($amount > max($pending, 0) && ! $isAdvance) {
                    $shown = number_format(max($pending, 0), 2);
                    throw ValidationException::withMessages([
                        'amount' => __('पेमेंट बाकी रकमेपेक्षा (₹:pending) जास्त आहे. जास्तीची रक्कम घेण्यासाठी "आगाऊ पेमेंट" निवडा.', ['pending' => $shown]),
                    ]);
                }

                $payment = Payment::create([
                    'customer_id' => $data['customer_id'],
                    'payment_date' => $data['payment_date'],
                    'amount' => $amount,
                    'payment_mode' => $data['payment_mode'],
                    'previous_pending' => $pending,
                    'remaining_pending' => round($pending - $amount, 2),
                    'is_advance' => $isAdvance,
                    'notes' => $data['notes'] ?? null,
                    'client_uuid' => $data['client_uuid'] ?? null,
                    'created_by' => $userId,
                ]);

                $this->ledger->rebuild($payment->customer_id);
                $this->reminders->syncCustomer($payment->customer_id);

                return [$payment, true];
            });
        } catch (UniqueConstraintViolationException $e) {
            $existing = Payment::where('client_uuid', $data['client_uuid'] ?? null)->first();
            if (! $existing) {
                throw $e;
            }

            return [$existing, false];
        }
    }

    /** Correct a saved payment (amount, date, mode, advance, notes). Customer stays fixed. */
    public function update(Payment $payment, array $data): Payment
    {
        return DB::transaction(function () use ($payment, $data) {
            Customer::withTrashed()->whereKey($payment->customer_id)->lockForUpdate()->first();
            $payment->refresh();

            // What the customer would owe if this payment didn't exist.
            $pendingWithout = round($this->balances->forCustomer($payment->customer_id)['pending'] + $payment->amount, 2);
            $amount = round((float) $data['amount'], 2);
            $isAdvance = (bool) ($data['is_advance'] ?? false);

            if ($amount > max($pendingWithout, 0) && ! $isAdvance) {
                $shown = number_format(max($pendingWithout, 0), 2);
                throw ValidationException::withMessages([
                    'amount' => __('पेमेंट बाकी रकमेपेक्षा (₹:pending) जास्त आहे. जास्तीची रक्कम घेण्यासाठी "आगाऊ पेमेंट" निवडा.', ['pending' => $shown]),
                ]);
            }

            // previous_pending stays the receipt's original "before" figure.
            $payment->update([
                'payment_date' => $data['payment_date'],
                'amount' => $amount,
                'payment_mode' => $data['payment_mode'],
                'is_advance' => $isAdvance,
                'remaining_pending' => round($payment->previous_pending - $amount, 2),
                'notes' => $data['notes'] ?? null,
            ]);

            $this->ledger->rebuild($payment->customer_id);
            $this->reminders->syncCustomer($payment->customer_id);

            return $payment->fresh();
        });
    }

    public function delete(Payment $payment): void
    {
        DB::transaction(function () use ($payment) {
            Customer::withTrashed()->whereKey($payment->customer_id)->lockForUpdate()->first();
            $payment->delete();
            $this->ledger->rebuild($payment->customer_id);
            $this->reminders->syncCustomer($payment->customer_id);
        });
    }
}
