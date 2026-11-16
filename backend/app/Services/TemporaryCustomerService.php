<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;

/**
 * A temporary (walk-in / one-time) customer is removed automatically once everything is settled:
 * no jars/bottles left with them, no udhari or advance, no deposit held and no pending booking.
 * It is a soft delete (same as deleting a customer by hand), so every past entry and report stays.
 */
class TemporaryCustomerService
{
    public function __construct(private BalanceService $balances) {}

    /** Call after an entry/payment is saved. Returns true when the customer was removed. */
    public function removeIfSettled(int $customerId): bool
    {
        $customer = Customer::whereKey($customerId)->where('is_temporary', true)->first();
        if (! $customer) {
            return false;
        }

        $b = $this->balances->forCustomer($customerId);
        $settled = $b['current_jars'] <= 0 && $b['current_bottles'] <= 0
            && abs($b['pending']) < 0.005 && $b['deposit_held'] < 0.005;
        if (! $settled || Booking::where('customer_id', $customerId)->where('status', 'booked')->exists()) {
            return false;
        }

        $customer->delete();

        return true;
    }
}
