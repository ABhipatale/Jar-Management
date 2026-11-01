<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Old jars / bottles a customer already had before the shop started using the app.
 * Added to current_jars / current_bottles (and so taken out of the shop's available stock).
 * Existing customers get 0, so nothing changes for them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->unsignedInteger('opening_jars')->default(0)->after('opening_balance');
            $table->unsignedInteger('opening_bottles')->default(0)->after('opening_jars');
        });
    }

    public function down(): void
    {
        Schema::table('customers', fn (Blueprint $t) => $t->dropColumn(['opening_jars', 'opening_bottles']));
    }
};
