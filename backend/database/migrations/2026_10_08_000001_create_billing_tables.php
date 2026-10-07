<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Paid plans (managed by the super admin) and Razorpay subscriptions/payments per company.
 * Starts with two plans: Monthly ₹250 and Yearly ₹1999.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->string('name_mr', 60)->nullable();
            $table->decimal('price', 10, 2);                 // rupees, per interval
            $table->enum('interval', ['month', 'year']);
            $table->string('description', 500)->nullable();
            $table->boolean('is_active')->default(true);     // inactive = hidden from companies
            $table->unsignedInteger('sort_order')->default(0);
            // Razorpay plan objects cannot change; a new one is made after a price/interval change.
            $table->string('razorpay_plan_id', 40)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // One row per Razorpay subscription (auto-renewing payment) a company started.
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('razorpay_subscription_id', 40)->unique();
            // created → active (paid, renewing) → cancelled / halted (renewal failed) / completed
            $table->string('status', 20)->default('created')->index();
            $table->boolean('cancel_at_period_end')->default(false);
            $table->timestamps();
        });

        // Every successful plan payment (first one and each automatic renewal).
        Schema::create('billing_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained('subscriptions')->nullOnDelete();
            $table->foreignId('plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->string('razorpay_payment_id', 40)->unique();  // idempotency: never extend twice
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('INR');
            $table->timestamp('period_end')->nullable();           // plan end date after this payment
            $table->timestamps();
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->foreignId('plan_id')->nullable()->after('plan')->constrained('plans')->nullOnDelete();
        });

        $now = now();
        DB::table('plans')->insert([
            ['name' => 'Monthly', 'name_mr' => 'मासिक', 'price' => 250, 'interval' => 'month', 'description' => null,
                'is_active' => true, 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Yearly', 'name_mr' => 'वार्षिक', 'price' => 1999, 'interval' => 'year', 'description' => null,
                'is_active' => true, 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::table('companies', fn (Blueprint $t) => $t->dropConstrainedForeignId('plan_id'));
        Schema::dropIfExists('billing_payments');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plans');
    }
};
