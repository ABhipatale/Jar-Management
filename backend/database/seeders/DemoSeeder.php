<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Customer;
use App\Support\CurrentCompany;
use App\Services\JarService;
use App\Services\JarTransactionService;
use App\Services\PaymentService;
use Illuminate\Database\Seeder;

/**
 * Optional sample data for trying the app locally, added to the FIRST company:
 *   php artisan db:seed --class=DemoSeeder
 * Do NOT run this on the live database.
 */
class DemoSeeder extends Seeder
{
    public function run(JarService $jars, JarTransactionService $tx, PaymentService $payments): void
    {
        $company = Company::orderBy('id')->firstOrFail();
        CurrentCompany::run($company, fn () => $this->seed($jars, $tx, $payments));
    }

    private function seed(JarService $jars, JarTransactionService $tx, PaymentService $payments): void
    {
        $jars->setTotal(100);

        $people = [
            ['Rahul Patil', '9876543210', 'Kolewadi'],
            ['Sunil More', '9823456789', 'Main Road, Kolewadi'],
            ['Ganesh Hotel', '9765432109', 'Bus Stand'],
            ['Anita Jadhav', '9922334455', 'School Lane'],
        ];

        foreach ($people as $i => [$name, $mobile, $address]) {
            $c = Customer::create(['name' => $name, 'mobile' => $mobile, 'address' => $address, 'status' => 'active']);

            foreach ([6, 4, 2, 1, 0] as $k => $daysAgo) {
                $date = now()->subDays($daysAgo)->toDateString();
                $qty = 2 + (($i + $k) % 4);
                $amount = $qty * 30;
                $tx->create([
                    'customer_id' => $c->id, 'transaction_date' => $date, 'transaction_type' => 'given',
                    'jar_quantity' => $qty, 'rate' => 30, 'payment_type' => $k % 2 ? 'udhari' : 'cash',
                    'paid_amount' => $k % 2 ? $amount / 2 : $amount,
                ], null);
                if ($k > 0) {
                    $tx->create([
                        'customer_id' => $c->id, 'transaction_date' => $date, 'transaction_type' => 'returned',
                        'jar_quantity' => max(1, $qty - 1),
                    ], null);
                }
            }

            $payments->create([
                'customer_id' => $c->id, 'payment_date' => now()->toDateString(),
                'amount' => 30, 'payment_mode' => $i % 2 ? 'upi' : 'cash',
            ], null);
        }
    }
}
