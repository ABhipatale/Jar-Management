<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Jar;
use App\Models\JarTransaction;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class JarTransactionService
{
    public function __construct(
        private BalanceService $balances,
        private LedgerService $ledger,
        private JarService $jars,
        private ReminderService $reminders,
        private BookingService $bookings,
    ) {}

    /**
     * Save a GIVE / RETURN entry. All money is recalculated here; the app's numbers
     * are only a preview. Returns [transaction, created(bool), balance-after, returned-qty].
     *
     * A GIVE entry may also carry return_quantity: empty jars the customer handed back at
     * the same delivery. That is saved as a separate RETURN row in the same DB transaction,
     * before the GIVE, so the empties are back in the shop when the stock check runs.
     */
    public function create(array $data, ?int $userId): array
    {
        if (! empty($data['client_uuid']) && $existing = JarTransaction::where('client_uuid', $data['client_uuid'])->first()) {
            return [$existing, false, $this->balances->forCustomer($existing->customer_id), 0];
        }

        try {
            return DB::transaction(function () use ($data, $userId) {
                // Row lock: two quick saves for the same customer are applied one after another.
                Customer::whereKey($data['customer_id'])->lockForUpdate()->firstOrFail();
                $before = $this->balances->forCustomer($data['customer_id']);

                $qty = (int) $data['jar_quantity'];
                $row = [
                    'customer_id' => $data['customer_id'],
                    'transaction_date' => $data['transaction_date'],
                    'transaction_type' => $data['transaction_type'],
                    'jar_quantity' => $qty,
                    'notes' => $data['notes'] ?? null,
                    'client_uuid' => $data['client_uuid'] ?? null,
                    'created_by' => $userId,
                ];

                if ($data['transaction_type'] === JarTransaction::RETURNED) {
                    if ($qty > $before['current_jars']) {
                        throw ValidationException::withMessages([
                            'jar_quantity' => $before['current_jars'] === 0
                                ? __('या ग्राहकाकडे परत करण्यासाठी जार नाहीत.')
                                : __('ग्राहकाकडे फक्त :jars जार आहेत. :qty जार परत घेता येणार नाहीत.', ['jars' => $before['current_jars'], 'qty' => $qty]),
                        ]);
                    }
                    $row += ['payment_type' => 'cash', 'rate' => 0, 'amount' => 0, 'paid_amount' => 0, 'udhari_amount' => 0, 'advance_amount' => 0];
                } else {
                    $returnQty = (int) ($data['return_quantity'] ?? 0);
                    if ($returnQty > 0) {
                        if ($returnQty > $before['current_jars']) {
                            throw ValidationException::withMessages([
                                'return_quantity' => $before['current_jars'] === 0
                                    ? __('या ग्राहकाकडे परत करण्यासाठी जार नाहीत.')
                                    : __('ग्राहकाकडे फक्त :jars जार आहेत. :qty जार परत घेता येणार नाहीत.', ['jars' => $before['current_jars'], 'qty' => $returnQty]),
                            ]);
                        }
                        JarTransaction::create([
                            'customer_id' => $data['customer_id'],
                            'transaction_date' => $data['transaction_date'],
                            'transaction_type' => JarTransaction::RETURNED,
                            'jar_quantity' => $returnQty,
                            'payment_type' => 'cash', 'rate' => 0, 'amount' => 0, 'paid_amount' => 0, 'udhari_amount' => 0, 'advance_amount' => 0,
                            'notes' => $data['notes'] ?? null,
                            'created_by' => $userId,
                        ]);
                    }

                    // Can't give more jars than are in the shop. Locking the jar rows makes two
                    // simultaneous "give" entries (for different customers) wait for each other.
                    Jar::query()->lockForUpdate()->pluck('id');
                    $available = $this->jars->summary()['available_jars'];
                    if ($qty > $available) {
                        throw ValidationException::withMessages([
                            'jar_quantity' => match (true) {
                                Jar::count() === 0 => __("अजून स्टॉकमध्ये जार नाहीत. आधी 'जार' विभागात जार जोडा."),
                                $available <= 0 => __('दुकानात एकही जार उपलब्ध नाही. सर्व जार ग्राहकांकडे आहेत किंवा खराब/हरवलेले आहेत.'),
                                default => __('दुकानात फक्त :available जार उपलब्ध आहेत. :qty जार देता येणार नाहीत.', ['available' => $available, 'qty' => $qty]),
                            },
                        ]);
                    }

                    $row += $this->giveMoney($qty, $data);
                }

                $tx = JarTransaction::create($row);
                $this->reminders->forGive($tx, $data['reminder_days'] ?? null);
                if ($tx->transaction_type === JarTransaction::GIVEN && ! empty($data['booking_id'])) {
                    $this->bookings->markDelivered((int) $data['booking_id'], $tx);
                }
                $this->ledger->rebuild($tx->customer_id);
                $this->reminders->syncCustomer($tx->customer_id);

                return [$tx, true, $this->balances->forCustomer($tx->customer_id), $returnQty ?? 0];
            });
        } catch (UniqueConstraintViolationException $e) {
            // Same client_uuid arrived twice at the same moment (offline sync retry).
            $existing = JarTransaction::where('client_uuid', $data['client_uuid'] ?? null)->first();
            if (! $existing) {
                throw $e;
            }

            return [$existing, false, $this->balances->forCustomer($existing->customer_id), 0];
        }
    }

    /**
     * Correct a saved entry (wrong amount, udhari instead of cash, wrong date/quantity…).
     * Customer and type stay fixed: delete and re-enter for those. Money is recalculated
     * exactly like a new entry, and the same jar/stock rules apply to the change.
     *
     * @return array{0: JarTransaction, 1: array}
     */
    public function update(JarTransaction $tx, array $data): array
    {
        return DB::transaction(function () use ($tx, $data) {
            Customer::withTrashed()->whereKey($tx->customer_id)->lockForUpdate()->first();
            $tx->refresh();
            Jar::query()->lockForUpdate()->pluck('id');

            $qty = (int) $data['jar_quantity'];
            $oldQty = (int) $tx->jar_quantity;
            $jarsNow = $this->balances->forCustomer($tx->customer_id)['current_jars'];
            $available = $this->jars->summary()['available_jars'];

            $row = [
                'transaction_date' => $data['transaction_date'],
                'jar_quantity' => $qty,
                'notes' => $data['notes'] ?? null,
            ];

            if ($tx->transaction_type === JarTransaction::RETURNED) {
                // Without this entry the customer would hold $jarsNow + $oldQty jars.
                $holding = $jarsNow + $oldQty;
                if ($qty > $holding) {
                    throw ValidationException::withMessages([
                        'jar_quantity' => __('ग्राहकाकडे फक्त :jars जार आहेत. :qty जार परत घेता येणार नाहीत.', ['jars' => $holding, 'qty' => $qty]),
                    ]);
                }
                // Fewer jars returned means those jars stay with the customer: they must exist in the shop.
                if ($oldQty - $qty > $available) {
                    throw ValidationException::withMessages([
                        'jar_quantity' => __('दुकानात फक्त :available जार उपलब्ध आहेत. :qty जार देता येणार नाहीत.', ['available' => $available, 'qty' => $oldQty - $qty]),
                    ]);
                }
            } else {
                $diff = $qty - $oldQty;
                if ($diff > 0 && $diff > $available) {
                    throw ValidationException::withMessages([
                        'jar_quantity' => __('दुकानात फक्त :available जार उपलब्ध आहेत. :qty जार देता येणार नाहीत.', ['available' => $available, 'qty' => $diff]),
                    ]);
                }
                if ($diff < 0 && $jarsNow + $diff < 0) {
                    throw ValidationException::withMessages([
                        'jar_quantity' => __('ग्राहकाने यातील काही जार आधीच परत केले आहेत. दिलेले जार :min पेक्षा कमी करता येणार नाहीत.', ['min' => $oldQty - $jarsNow]),
                    ]);
                }
                $row += $this->giveMoney($qty, $data);
            }

            $tx->update($row);
            $this->reminders->reschedule($tx->fresh());
            $this->ledger->rebuild($tx->customer_id);
            $this->reminders->syncCustomer($tx->customer_id);

            return [$tx->fresh(), $this->balances->forCustomer($tx->customer_id)];
        });
    }

    /** Bill for a GIVE entry: amount = qty × rate, udhari = amount − paid. Validates paid ≤ amount. */
    private function giveMoney(int $qty, array $data): array
    {
        $rate = round((float) ($data['rate'] ?? 0), 2);
        $amount = round($qty * $rate, 2);
        $paymentType = $data['payment_type'] ?? 'cash';
        $paid = array_key_exists('paid_amount', $data) && $data['paid_amount'] !== null
            ? round((float) $data['paid_amount'], 2)
            : ($paymentType === 'cash' ? $amount : 0);

        if ($paid > $amount) {
            throw ValidationException::withMessages([
                'paid_amount' => __('भरलेली रक्कम बिलापेक्षा जास्त असू शकत नाही. जास्तीची रक्कम आगाऊ म्हणून टाका.'),
            ]);
        }

        return [
            'payment_type' => $paid >= $amount ? 'cash' : 'udhari',
            'rate' => $rate,
            'amount' => $amount,
            'paid_amount' => $paid,
            'udhari_amount' => round($amount - $paid, 2),
            'advance_amount' => round((float) ($data['advance_amount'] ?? 0), 2),
        ];
    }

    public function delete(JarTransaction $tx): void
    {
        DB::transaction(function () use ($tx) {
            Customer::withTrashed()->whereKey($tx->customer_id)->lockForUpdate()->first();

            if ($tx->transaction_type === JarTransaction::RETURNED) {
                // Undoing a return puts the jars back with the customer — they must exist in the shop.
                Jar::query()->lockForUpdate()->pluck('id');
                $available = $this->jars->summary()['available_jars'];
                if ($tx->jar_quantity > $available) {
                    throw ValidationException::withMessages([
                        'transaction' => __('हटवता येत नाही: दुकानात फक्त :available जार आहेत, ही परत नोंद :qty जारची होती.', ['available' => $available, 'qty' => $tx->jar_quantity]),
                    ]);
                }
            }

            if ($tx->transaction_type === JarTransaction::GIVEN) {
                $jars = $this->balances->forCustomer($tx->customer_id)['current_jars'];
                if ($jars - $tx->jar_quantity < 0) {
                    throw ValidationException::withMessages([
                        'transaction' => __('हटवता येत नाही: यातील काही जार आधीच परत आले आहेत. आधी परत जारची नोंद हटवा.'),
                    ]);
                }
            }

            $tx->delete();
            $this->reminders->removeFor($tx);
            $this->bookings->reopenFor($tx);
            $this->ledger->rebuild($tx->customer_id);
            $this->reminders->syncCustomer($tx->customer_id);
        });
    }
}
