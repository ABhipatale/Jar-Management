<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->date('payment_date')->index();
            $table->decimal('amount', 12, 2);
            $table->enum('payment_mode', ['cash', 'upi', 'bank'])->default('cash');
            $table->decimal('previous_pending', 12, 2)->default(0);
            $table->decimal('remaining_pending', 12, 2)->default(0);
            $table->boolean('is_advance')->default(false);
            $table->text('notes')->nullable();
            $table->uuid('client_uuid')->nullable()->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['customer_id', 'payment_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
