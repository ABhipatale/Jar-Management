<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Temporary (walk-in / one-time) customers: customers.is_temporary, and companies.temporary_enabled
 * (the super admin switches the feature on per company). Default 0, so every
 * existing customer stays permanent and nothing changes until the owner picks "Temporary".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->boolean('is_temporary')->default(false)->after('status');
        });
        // Switched on per company by the super admin (off for everyone until then).
        Schema::table('companies', function (Blueprint $table) {
            $table->boolean('temporary_enabled')->default(false)->after('routes_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('temporary_enabled');
        });
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('is_temporary');
        });
    }
};
