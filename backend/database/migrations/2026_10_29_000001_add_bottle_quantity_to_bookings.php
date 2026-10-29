<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Advance bookings can include 20 L bottles (companies with bottles switched on).
 * Existing bookings get 0 bottles; jar_quantity stays as it is.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedInteger('bottle_quantity')->default(0)->after('jar_quantity');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', fn (Blueprint $t) => $t->dropColumn('bottle_quantity'));
    }
};
