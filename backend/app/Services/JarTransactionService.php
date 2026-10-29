<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Jar;
use App\Models\JarTransaction;
use App\Support\Products;
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
     * are only a preview. Returns [main transaction, created(bool), balance-after,
     * jars taken back, every row saved].
     *
     * One entry may cover jars and bottles ("lines"); each product is saved as its own
     * row so stock, balances, edits and deletes stay per product. Old clients send a
     * single jar_quantity / rate, which is read as one jar line.
     *
     * A GIVE line may also carry return_quantity: empties the customer handed back at
     * the same delivery. That is saved as a separate RETURN row in the same DB transaction,
     * before the GIVE, so the empties are back in the shop when the stock check runs.
     */
    public function create(array $data, ?int $userId): array
    {
        if (! empty($data['client_uuid']) && $existing = JarTransaction::where('client_uuid', $data['client_uuid'])->first()) {
            return [$existing, false, $this->balances->forCustomer($existing->customer_id), 0, [$existing]];
        }

        try {
            return DB::transaction(function () use ($data, $userId) {
                // Row lock: two quick saves for the same customer are applied one after another.
                $customer = Customer::whereKey($data['customer_id'])->lockForUpdate()->firstOrFail();
                $before = $this->balances->forCustomer($data['customer_id']);
                $lines = $this->lines($data);
                $takesDeposit = Products::depositEnabled() && ! $customer->no_deposit;

                $base = [
                    'customer_id' => $data['customer_id'],
                    'transaction_date' => $data['transaction_date'],
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $userId,
                ];
                $noMoney = ['payment_type' => 'cash', 'rate' => 0, 'amount' => 0, 'paid_amount' => 0, 'udhari_amount' => 0, 'advance_amount' => 0];
                $rows = [];
                $takenBack = 0;

                if ($data['transaction_type'] === JarTransaction::RETURNED) {
                    $this->requireSomething($lines, 'quantity');
                    foreach ($lines as $l) {
                        $this->checkHolding($l['product'], $l['quantity'], $before['held'][$l['product']], $this->qtyKey($l['product']));
                        $refund = $takesDeposit ? $l['deposit'] : 0.0;
                        if ($refund > $before['deposits'][$l['product']] + 0.004) {
                            throw ValidationException::withMessages([
                                'deposit_amount' => __('परत करायचे डिपॉझिट जमा डिपॉझिटपेक्षा (₹:held) जास्त असू शकत नाही.', ['held' => number_format($before['deposits'][$l['product']], 2)]),
                            ]);
                        }
                        if ($l['quantity'] > 0) {
                            $rows[] = JarTransaction::create($base + $noMoney + [
                                'transaction_type' => JarTransaction::RETURNED,
                                'product' => $l['product'],
                                'jar_quantity' => $l['quantity'],
                                'deposit_amount' => $refund,
                                'client_uuid' => $rows ? null : ($data['client_uuid'] ?? null),
                            ]);
                        }
                    }
                    $main = $rows[0];
                } else {
                    $this->requireSomething($lines, 'quantity');

                    foreach ($lines as $l) {
                        if ($l['return_quantity'] > 0) {
                            $this->checkHolding($l['product'], $l['return_quantity'], $before['held'][$l['product']], 'return_quantity');
                            JarTransaction::create($base + $noMoney + [
                                'transaction_type' => JarTransaction::RETURNED,
                                'product' => $l['product'],
                                'jar_quantity' => $l['return_quantity'],
                            ]);
                            if ($l['product'] === Products::JAR) {
                                $takenBack = $l['return_quantity'];
                            }
                        }
                    }

                    // Can't give more than are in the shop. Locking the jar rows makes two
                    // simultaneous "give" entries (for different customers) wait for each other.
                    Jar::query()->lockForUpdate()->pluck('id');
                    foreach ($lines as $l) {
                        if ($l['quantity'] > 0) {
                            $this->checkStock($l['product'], $l['quantity']);
                        }
                    }

                    $money = $this->giveMoneyLines($lines, $data);
                    foreach ($lines as $i => $l) {
                        if ($l['quantity'] < 1) {
                            continue;
                        }
                        $rows[] = JarTransaction::create($base + $money[$i] + [
                            'transaction_type' => JarTransaction::GIVEN,
                            'product' => $l['product'],
                            'jar_quantity' => $l['quantity'],
                            'deposit_amount' => $takesDeposit ? $l['deposit'] : 0.0,
                            'client_uuid' => $rows ? null : ($data['client_uuid'] ?? null),
                        ]);
                    }
                    $main = $rows[0];

                    $this->reminders->forGive($main, $data['reminder_days'] ?? null);
                    if (! empty($data['booking_id'])) {
                        $this->bookings->markDelivered((int) $data['booking_id'], $main);
                    }
                }

                $this->ledger->rebuild($main->customer_id);
                $this->reminders->syncCustomer($main->customer_id);

                return [$main, true, $this->balances->forCustomer($main->customer_id), $takenBack, $rows];
            });
        } catch (UniqueConstraintViolationException $e) {
            // Same client_uuid arrived twice at the same moment (offline sync retry).
            $existing = JarTransaction::where('client_uuid', $data['client_uuid'] ?? null)->first();
            if (! $existing) {
                throw $e;
            }

            return [$existing, false, $this->balances->forCustomer($existing->customer_id), 0, [$existing]];
        }
    }

    /**
     * The entry's product lines: [{product, quantity, rate, return_quantity, deposit}].
     * Without "lines" the old single-product fields make one line (a jar unless "product" says otherwise).
     */
    private function lines(array $data): array
    {
        $raw = ! empty($data['lines']) ? $data['lines'] : [[
            'product' => $data['product'] ?? Products::JAR,
            'quantity' => $data['jar_quantity'] ?? 0,
            'rate' => $data['rate'] ?? 0,
            'return_quantity' => $data['return_quantity'] ?? 0,
            'deposit_amount' => $data['deposit_amount'] ?? 0,
        ]];

        $lines = [];
        foreach ($raw as $l) {
            $product = $l['product'] ?? Products::JAR;
            if (isset($lines[$product])) {
                throw ValidationException::withMessages(['lines' => __('एकाच नोंदीत एक वस्तू दोनदा टाकता येत नाही.')]);
            }
            $lines[$product] = [
                'product' => $product,
                'quantity' => (int) ($l['quantity'] ?? 0),
                'rate' => round((float) ($l['rate'] ?? 0), 2),
                'return_quantity' => (int) ($l['return_quantity'] ?? 0),
                'deposit' => round(max(0, (float) ($l['deposit_amount'] ?? 0)), 2),
            ];
        }

        return array_values($lines);
    }

    private function requireSomething(array $lines, string $field): void
    {
        if (array_sum(array_column($lines, $field)) < 1) {
            throw ValidationException::withMessages(['jar_quantity' => __('जारची संख्या किमान 1 असावी.')]);
        }
    }

    private function qtyKey(string $product): string
    {
        return $product === Products::BOTTLE ? 'bottle_quantity' : 'jar_quantity';
    }

    /** The customer must hold at least $qty of the product to hand them back. */
    private function checkHolding(string $product, int $qty, int $holding, string $key): void
    {
        if ($qty > $holding) {
            throw ValidationException::withMessages([
                $key => $holding <= 0
                    ? Products::msg($product, 'या ग्राहकाकडे परत करण्यासाठी जार नाहीत.', 'या ग्राहकाकडे परत करण्यासाठी बाटल्या नाहीत.')
                    : Products::msg($product, 'ग्राहकाकडे फक्त :jars जार आहेत. :qty जार परत घेता येणार नाहीत.', 'ग्राहकाकडे फक्त :jars बाटल्या आहेत. :qty बाटल्या परत घेता येणार नाहीत.', ['jars' => $holding, 'qty' => $qty]),
            ]);
        }
    }

    /** The shop must have $qty of the product available. Caller holds the jar-row lock. */
    private function checkStock(string $product, int $qty): void
    {
        $available = $this->jars->summary($product)['available_jars'];
        if ($qty <= $available) {
            return;
        }
        throw ValidationException::withMessages([
            $this->qtyKey($product) => match (true) {
                Jar::where('product', $product)->count() === 0 => Products::msg($product,
                    "अजून स्टॉकमध्ये जार नाहीत. आधी 'जार' विभागात जार जोडा.",
                    "अजून स्टॉकमध्ये बाटल्या नाहीत. आधी 'जार' विभागात बाटल्या जोडा."),
                $available <= 0 => Products::msg($product,
                    'दुकानात एकही जार उपलब्ध नाही. सर्व जार ग्राहकांकडे आहेत किंवा खराब/हरवलेले आहेत.',
                    'दुकानात एकही बाटली उपलब्ध नाही. सर्व बाटल्या ग्राहकांकडे आहेत किंवा खराब/हरवलेल्या आहेत.'),
                default => $this->onlyAvailable($product, $available, $qty),
            },
        ]);
    }

    private function onlyAvailable(string $product, int $available, int $qty): string
    {
        return Products::msg($product,
            'दुकानात फक्त :available जार उपलब्ध आहेत. :qty जार देता येणार नाहीत.',
            'दुकानात फक्त :available बाटल्या उपलब्ध आहेत. :qty बाटल्या देता येणार नाहीत.',
            ['available' => $available, 'qty' => $qty]);
    }

    /**
     * Correct a saved entry (wrong amount, udhari instead of cash, wrong date/quantity…).
     * Customer, type and product stay fixed: delete and re-enter for those. Money is
     * recalculated exactly like a new entry, and the same stock rules apply to the change.
     *
     * @return array{0: JarTransaction, 1: array}
     */
    public function update(JarTransaction $tx, array $data): array
    {
        return DB::transaction(function () use ($tx, $data) {
            Customer::withTrashed()->whereKey($tx->customer_id)->lockForUpdate()->first();
            $tx->refresh();
            Jar::query()->lockForUpdate()->pluck('id');

            $product = $tx->product;
            $qty = (int) $data['jar_quantity'];
            $oldQty = (int) $tx->jar_quantity;
            $before = $this->balances->forCustomer($tx->customer_id);
            $jarsNow = $before['held'][$product];
            $available = $this->jars->summary($product)['available_jars'];

            $row = [
                'transaction_date' => $data['transaction_date'],
                'jar_quantity' => $qty,
                'notes' => $data['notes'] ?? null,
            ];

            if ($tx->transaction_type === JarTransaction::RETURNED) {
                // Without this entry the customer would hold $jarsNow + $oldQty.
                $this->checkHolding($product, $qty, $jarsNow + $oldQty, 'jar_quantity');
                // Fewer returned means those stay with the customer: they must exist in the shop.
                if ($oldQty - $qty > $available) {
                    throw ValidationException::withMessages(['jar_quantity' => $this->onlyAvailable($product, $available, $oldQty - $qty)]);
                }
            } else {
                $diff = $qty - $oldQty;
                if ($diff > 0 && $diff > $available) {
                    throw ValidationException::withMessages(['jar_quantity' => $this->onlyAvailable($product, $available, $diff)]);
                }
                if ($diff < 0 && $jarsNow + $diff < 0) {
                    throw ValidationException::withMessages([
                        'jar_quantity' => Products::msg($product,
                            'ग्राहकाने यातील काही जार आधीच परत केले आहेत. दिलेले जार :min पेक्षा कमी करता येणार नाहीत.',
                            'ग्राहकाने यातील काही बाटल्या आधीच परत केल्या आहेत. दिलेल्या बाटल्या :min पेक्षा कमी करता येणार नाहीत.',
                            ['min' => $oldQty - $jarsNow]),
                    ]);
                }
                $row += $this->giveMoney($qty, $data);
            }

            // Deposit: only changed when sent and the company uses deposits.
            if (array_key_exists('deposit_amount', $data) && $data['deposit_amount'] !== null && Products::depositEnabled()) {
                $deposit = round(max(0, (float) $data['deposit_amount']), 2);
                $old = (float) $tx->deposit_amount;
                $heldAfter = $tx->transaction_type === JarTransaction::GIVEN
                    ? $before['deposits'][$product] - $old + $deposit
                    : $before['deposits'][$product] + $old - $deposit;
                if ($heldAfter < -0.004) {
                    throw ValidationException::withMessages(['deposit_amount' => $this->depositTooLow()]);
                }
                $row['deposit_amount'] = $deposit;
            }

            $tx->update($row);
            $this->reminders->reschedule($tx->fresh());
            $this->ledger->rebuild($tx->customer_id);
            $this->reminders->syncCustomer($tx->customer_id);

            return [$tx->fresh(), $this->balances->forCustomer($tx->customer_id)];
        });
    }

    private function depositTooLow(): string
    {
        return __('हे करता येत नाही: यातील डिपॉझिट ग्राहकाला आधीच परत केले आहे.');
    }

    /** Bill for a GIVE entry: amount = qty × rate, udhari = amount − paid. Validates paid ≤ amount. */
    private function giveMoney(int $qty, array $data): array
    {
        return $this->giveMoneyLines([['quantity' => $qty, 'rate' => round((float) ($data['rate'] ?? 0), 2)]], $data)[0];
    }

    /**
     * Bill for a GIVE entry with one or more product lines. Paid / payment type / advance are
     * for the whole entry: paid is spread over the lines in order, advance goes on the first.
     * Returns the money columns for each line (same keys as $lines).
     */
    private function giveMoneyLines(array $lines, array $data): array
    {
        $amounts = [];
        foreach ($lines as $i => $l) {
            $amounts[$i] = $l['quantity'] > 0 ? round($l['quantity'] * $l['rate'], 2) : 0.0;
        }
        $total = round(array_sum($amounts), 2);

        $paymentType = $data['payment_type'] ?? 'cash';
        $paid = array_key_exists('paid_amount', $data) && $data['paid_amount'] !== null
            ? round((float) $data['paid_amount'], 2)
            : ($paymentType === 'cash' ? $total : 0);

        if ($paid > $total) {
            throw ValidationException::withMessages([
                'paid_amount' => __('भरलेली रक्कम बिलापेक्षा जास्त असू शकत नाही. जास्तीची रक्कम आगाऊ म्हणून टाका.'),
            ]);
        }

        $left = $paid;
        $advance = round((float) ($data['advance_amount'] ?? 0), 2);
        $first = true;
        $money = [];
        foreach ($lines as $i => $l) {
            if ($l['quantity'] < 1) {
                continue;
            }
            $amount = $amounts[$i];
            $linePaid = round(min($left, $amount), 2);
            $left = round($left - $linePaid, 2);
            $money[$i] = [
                'payment_type' => $linePaid >= $amount ? 'cash' : 'udhari',
                'rate' => $l['rate'],
                'amount' => $amount,
                'paid_amount' => $linePaid,
                'udhari_amount' => round($amount - $linePaid, 2),
                'advance_amount' => $first ? $advance : 0,
            ];
            $first = false;
        }

        return $money;
    }

    public function delete(JarTransaction $tx): void
    {
        DB::transaction(function () use ($tx) {
            Customer::withTrashed()->whereKey($tx->customer_id)->lockForUpdate()->first();
            $product = $tx->product;
            $before = $this->balances->forCustomer($tx->customer_id);

            if ($tx->transaction_type === JarTransaction::RETURNED) {
                // Undoing a return puts the items back with the customer — they must exist in the shop.
                Jar::query()->lockForUpdate()->pluck('id');
                $available = $this->jars->summary($product)['available_jars'];
                if ($tx->jar_quantity > $available) {
                    throw ValidationException::withMessages([
                        'transaction' => Products::msg($product,
                            'हटवता येत नाही: दुकानात फक्त :available जार आहेत, ही परत नोंद :qty जारची होती.',
                            'हटवता येत नाही: दुकानात फक्त :available बाटल्या आहेत, ही परत नोंद :qty बाटल्यांची होती.',
                            ['available' => $available, 'qty' => $tx->jar_quantity]),
                    ]);
                }
            }

            if ($tx->transaction_type === JarTransaction::GIVEN) {
                if ($before['held'][$product] - $tx->jar_quantity < 0) {
                    throw ValidationException::withMessages([
                        'transaction' => Products::msg($product,
                            'हटवता येत नाही: यातील काही जार आधीच परत आले आहेत. आधी परत जारची नोंद हटवा.',
                            'हटवता येत नाही: यातील काही बाटल्या आधीच परत आल्या आहेत. आधी परत बाटल्यांची नोंद हटवा.'),
                    ]);
                }
                if ($before['deposits'][$product] - (float) $tx->deposit_amount < -0.004) {
                    throw ValidationException::withMessages(['transaction' => $this->depositTooLow()]);
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
