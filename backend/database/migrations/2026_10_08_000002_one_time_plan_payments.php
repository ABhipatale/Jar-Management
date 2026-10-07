<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Plan payments become one-time Razorpay Orders (the company pays again each month/year)
 * instead of auto-renewing Razorpay Subscriptions.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('billing_payments', fn (Blueprint $t) => $t->dropConstrainedForeignId('subscription_id'));
        Schema::dropIfExists('subscriptions');
        Schema::table('plans', fn (Blueprint $t) => $t->dropColumn('razorpay_plan_id'));

        // One row per Razorpay order (one payment attempt for one plan period).
        Schema::create('billing_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('razorpay_order_id', 40)->unique();
            $table->decimal('amount', 10, 2);
            $table->string('status', 20)->default('created')->index(); // created → paid
            $table->timestamps();
        });

        Schema::table('billing_payments', function (Blueprint $table) {
            $table->foreignId('billing_order_id')->nullable()->after('company_id')->constrained('billing_orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('billing_payments', fn (Blueprint $t) => $t->dropConstrainedForeignId('billing_order_id'));
        Schema::dropIfExists('billing_orders');
        Schema::table('plans', fn (Blueprint $t) => $t->string('razorpay_plan_id', 40)->nullable());
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('razorpay_subscription_id', 40)->unique();
            $table->string('status', 20)->default('created')->index();
            $table->boolean('cancel_at_period_end')->default(false);
            $table->timestamps();
        });
        Schema::table('billing_payments', function (Blueprint $table) {
            $table->foreignId('subscription_id')->nullable()->after('company_id')->constrained('subscriptions')->nullOnDelete();
        });
    }
};
