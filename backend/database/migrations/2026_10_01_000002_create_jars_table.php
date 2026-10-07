<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per physical jar. Quantity-based shops never look at jar numbers;
        // the rows just give us a reliable total and damaged/lost counts.
        Schema::create('jars', function (Blueprint $table) {
            $table->id();
            $table->string('jar_number', 20)->unique();
            $table->enum('status', ['available', 'with_customer', 'returned', 'damaged', 'lost'])
                ->default('available')->index();
            // Only used when individual jar tracking is switched on.
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            // When the jar last changed status (monthly damaged/lost counts use this).
            $table->date('status_date')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jars');
    }
};
