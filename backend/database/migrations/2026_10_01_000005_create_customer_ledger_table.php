<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Derived statement rows, rebuilt by LedgerService inside the same DB
        // transaction as every jar entry / payment, so balances never drift.
        Schema::create('customer_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->date('entry_date');
            $table->enum('entry_type', ['given', 'returned', 'payment']);
            $table->foreignId('jar_transaction_id')->nullable()->constrained('jar_transactions')->cascadeOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained('payments')->cascadeOnDelete();
            $table->unsignedInteger('jars_given')->default(0);
            $table->unsignedInteger('jars_returned')->default(0);
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('paid', 12, 2)->default(0);
            $table->decimal('udhari', 12, 2)->default(0);
            $table->decimal('balance', 12, 2)->default(0);   // pending after this row
            $table->integer('jar_balance')->default(0);      // jars with customer after this row
            $table->string('description')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_ledger');
    }
};
