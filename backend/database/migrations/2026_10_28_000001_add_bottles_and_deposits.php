<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Second product (20 L bottle) and refundable deposits.
 *
 * Both are switched on per company by the super admin (default off). Every existing row
 * gets product = 'jar' and deposit 0 from the column defaults, so current data and
 * companies that never turn the features on behave exactly as before.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->boolean('bottles_enabled')->default(false)->after('status');
            $table->boolean('deposit_enabled')->default(false)->after('bottles_enabled');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->boolean('takes_jar')->default(true)->after('status');
            $table->boolean('takes_bottle')->default(false)->after('takes_jar');
            // Special price for this customer; null = the shop's default rate.
            $table->decimal('jar_rate', 10, 2)->nullable()->after('takes_bottle');
            $table->decimal('bottle_rate', 10, 2)->nullable()->after('jar_rate');
            $table->boolean('no_deposit')->default(false)->after('bottle_rate');
        });

        Schema::table('jar_transactions', function (Blueprint $table) {
            $table->string('product', 10)->default('jar')->after('transaction_type');
            // GIVE: deposit collected. RETURN: deposit refunded. Never part of udhari.
            $table->decimal('deposit_amount', 12, 2)->default(0)->after('advance_amount');
            $table->index(['customer_id', 'product']);
        });

        Schema::table('jars', function (Blueprint $table) {
            $table->string('product', 10)->default('jar')->after('jar_number');
            $table->index(['company_id', 'product', 'status']);
        });

        Schema::table('customer_ledger', function (Blueprint $table) {
            $table->string('product', 10)->default('jar')->after('entry_type');
            $table->decimal('deposit', 12, 2)->default(0)->after('udhari');
            $table->integer('bottle_balance')->default(0)->after('jar_balance');
            $table->decimal('deposit_balance', 12, 2)->default(0)->after('bottle_balance');
        });
    }

    public function down(): void
    {
        Schema::table('customer_ledger', fn (Blueprint $t) => $t->dropColumn(['product', 'deposit', 'bottle_balance', 'deposit_balance']));
        Schema::table('jars', function (Blueprint $t) {
            $t->dropIndex(['company_id', 'product', 'status']);
            $t->dropColumn('product');
        });
        Schema::table('jar_transactions', function (Blueprint $t) {
            $t->dropIndex(['customer_id', 'product']);
            $t->dropColumn(['product', 'deposit_amount']);
        });
        Schema::table('customers', fn (Blueprint $t) => $t->dropColumn(['takes_jar', 'takes_bottle', 'jar_rate', 'bottle_rate', 'no_deposit']));
        Schema::table('companies', fn (Blueprint $t) => $t->dropColumn(['bottles_enabled', 'deposit_enabled']));
    }
};
