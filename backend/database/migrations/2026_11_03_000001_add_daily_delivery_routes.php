<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Daily delivery routes (morning / evening), switched on per company by the super admin.
 *
 *  - companies.routes_enabled: off for everyone until switched on.
 *  - customers: which route(s), jars per route, how often, fixed order, a delivery note.
 *    Defaults = on no route, so every existing customer and screen is unchanged.
 *  - route_stops: today's saved route, made when the owner presses "Start". One row per
 *    company + date + session + customer (unique), so a route can never be duplicated.
 *    A delivered stop points at the normal jar entry it created.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->boolean('routes_enabled')->default(false)->after('deposit_enabled');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->boolean('route_morning')->default(false)->after('opening_bottles');
            $table->boolean('route_evening')->default(false)->after('route_morning');
            $table->unsignedSmallInteger('morning_qty')->default(1)->after('route_evening');
            $table->unsignedSmallInteger('evening_qty')->default(1)->after('morning_qty');
            // daily | every (every N days, counted from the last delivery) | weekdays | booked (on request only)
            $table->string('schedule_type', 10)->default('daily')->after('evening_qty');
            $table->unsignedTinyInteger('schedule_every')->default(2)->after('schedule_type');
            $table->string('schedule_days', 20)->nullable()->after('schedule_every'); // ISO weekdays "1,3,5"
            $table->unsignedInteger('morning_order')->nullable()->after('schedule_days');
            $table->unsignedInteger('evening_order')->nullable()->after('morning_order');
            $table->string('delivery_note', 255)->nullable()->after('evening_order');
        });

        Schema::create('route_stops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->date('route_date');
            $table->string('session', 10); // morning | evening
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->unsignedInteger('position');
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->string('status', 10)->default('pending'); // pending | done | skipped
            $table->string('skip_reason', 40)->nullable();
            $table->foreignId('jar_transaction_id')->nullable()->constrained('jar_transactions')->nullOnDelete();
            $table->boolean('added_manually')->default(false);
            $table->timestamp('done_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'route_date', 'session', 'customer_id']);
            $table->index(['company_id', 'route_date', 'session', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('route_stops');
        Schema::table('customers', fn (Blueprint $t) => $t->dropColumn([
            'route_morning', 'route_evening', 'morning_qty', 'evening_qty', 'schedule_type', 'schedule_every',
            'schedule_days', 'morning_order', 'evening_order', 'delivery_note',
        ]));
        Schema::table('companies', fn (Blueprint $t) => $t->dropColumn('routes_enabled'));
    }
};
