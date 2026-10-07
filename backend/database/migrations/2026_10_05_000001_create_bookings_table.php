<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Advance orders: "I need 10 jars on 08-10-2026".
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->date('delivery_date')->index();
            $table->unsignedInteger('jar_quantity');
            $table->text('notes')->nullable();
            $table->enum('status', ['booked', 'delivered', 'cancelled'])->default('booked')->index();
            // Set when the delivery is saved as a normal "give jars" entry.
            $table->foreignId('jar_transaction_id')->nullable()->constrained('jar_transactions')->nullOnDelete();
            $table->timestamp('eve_notified_at')->nullable();     // night-before phone notification sent
            $table->timestamp('morning_notified_at')->nullable(); // same-day morning notification sent
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
