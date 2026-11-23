<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Invoice numbers for customer bills and manual bills (B-2026-00001, B-2026-00002, ...).
 * One running number per shop per year. `key` identifies the bill (customer + period, or a manual
 * bill draft), so opening or sending the same bill again always gives the same number.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('seq');
            $table->string('number', 30);
            $table->string('key', 120);
            $table->date('period_from')->nullable();
            $table->date('period_to')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'key']);
            $table->unique(['company_id', 'number']);
            $table->unique(['company_id', 'year', 'seq']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
