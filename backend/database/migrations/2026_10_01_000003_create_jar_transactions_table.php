<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jar_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->date('transaction_date')->index();
            $table->enum('transaction_type', ['given', 'returned'])->index();
            $table->unsignedInteger('jar_quantity');
            $table->enum('payment_type', ['cash', 'udhari'])->default('cash');
            $table->decimal('rate', 10, 2)->default(0);
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('udhari_amount', 12, 2)->default(0);
            // Extra money received on top of this bill; reduces the customer's pending.
            $table->decimal('advance_amount', 12, 2)->default(0);
            $table->text('notes')->nullable();
            // Idempotency key from the app: a retried/offline-synced save never duplicates.
            $table->uuid('client_uuid')->nullable()->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['customer_id', 'transaction_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jar_transactions');
    }
};
