<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Plan money the super admin collected offline (cash / UPI / bank / cheque) sits beside the Razorpay payments. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('billing_payments', function (Blueprint $table) {
            $table->string('razorpay_payment_id', 40)->nullable()->change(); // offline payments have none
            $table->string('mode', 10)->default('online')->after('currency'); // online | offline
            $table->string('method', 20)->nullable()->after('mode');
            $table->string('note', 255)->nullable()->after('method');
        });
    }

    public function down(): void
    {
        Schema::table('billing_payments', function (Blueprint $table) {
            $table->dropColumn(['mode', 'method', 'note']);
        });
    }
};
