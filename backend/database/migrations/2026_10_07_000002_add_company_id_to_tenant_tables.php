<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Multi-company: every business table gets company_id.
 *
 * Existing single-shop data is kept: if the database already has users or customers,
 * company #1 is created from the saved shop settings and every existing row is assigned
 * to it. Steps: add nullable column → backfill → make NOT NULL → swap unique indexes.
 */
return new class extends Migration
{
    private const TABLES = [
        'customers', 'jars', 'jar_transactions', 'payments', 'customer_ledger',
        'expenses', 'settings', 'reminders', 'push_subscriptions', 'bookings',
    ];

    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->after('id')->constrained('companies')->restrictOnDelete();
            $table->string('role', 20)->default('owner')->after('company_id');   // super_admin | owner | staff
            $table->boolean('is_active')->default(true)->after('role');
        });

        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->foreignId('company_id')->nullable()->after('id')->constrained('companies')->cascadeOnDelete();
            });
        }

        $companyId = $this->firstCompanyForExistingData();
        if ($companyId) {
            DB::table('users')->update(['company_id' => $companyId, 'role' => 'owner']);
            foreach (self::TABLES as $name) {
                DB::table($name)->update(['company_id' => $companyId]);
            }
        }

        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) use ($name) {
                $table->unsignedBigInteger('company_id')->nullable(false)->change();
                match ($name) {
                    'settings' => $table->dropUnique(['key']),
                    'jars' => $table->dropUnique(['jar_number']),
                    default => null,
                };
            });
        }

        // Per-company uniqueness and the indexes every tenant query starts with.
        Schema::table('settings', fn (Blueprint $t) => $t->unique(['company_id', 'key']));
        Schema::table('jars', fn (Blueprint $t) => $t->unique(['company_id', 'jar_number']));
        Schema::table('customers', fn (Blueprint $t) => $t->index(['company_id', 'mobile']));
        Schema::table('jar_transactions', fn (Blueprint $t) => $t->index(['company_id', 'transaction_date']));
        Schema::table('payments', fn (Blueprint $t) => $t->index(['company_id', 'payment_date']));
        Schema::table('expenses', fn (Blueprint $t) => $t->index(['company_id', 'expense_date']));
        Schema::table('reminders', fn (Blueprint $t) => $t->index(['company_id', 'status', 'remind_on']));
        Schema::table('bookings', fn (Blueprint $t) => $t->index(['company_id', 'status', 'delivery_date']));
    }

    /** Creates company #1 only when there is single-shop data to keep. */
    private function firstCompanyForExistingData(): ?int
    {
        if (! DB::table('users')->exists() && ! DB::table('customers')->exists()) {
            return null;
        }

        $settings = DB::table('settings')->pluck('value', 'key');
        $now = now();

        return DB::table('companies')->insertGetId([
            'name' => $settings['business_name'] ?? 'Sai Water Suppliers',
            'name_mr' => $settings['business_name_mr'] ?? 'साई वॉटर सप्लायर्स',
            'short_name' => 'साई वॉटर',
            'slug' => 'sai',
            'theme_color' => '#1d45d8',
            'background_color' => '#ffffff',
            'locale' => 'mr',
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $t) {
            $t->dropUnique(['company_id', 'key']);
            $t->unique('key');
        });
        Schema::table('jars', function (Blueprint $t) {
            $t->dropUnique(['company_id', 'jar_number']);
            $t->unique('jar_number');
        });
        Schema::table('customers', fn (Blueprint $t) => $t->dropIndex(['company_id', 'mobile']));
        Schema::table('jar_transactions', fn (Blueprint $t) => $t->dropIndex(['company_id', 'transaction_date']));
        Schema::table('payments', fn (Blueprint $t) => $t->dropIndex(['company_id', 'payment_date']));
        Schema::table('expenses', fn (Blueprint $t) => $t->dropIndex(['company_id', 'expense_date']));
        Schema::table('reminders', fn (Blueprint $t) => $t->dropIndex(['company_id', 'status', 'remind_on']));
        Schema::table('bookings', fn (Blueprint $t) => $t->dropIndex(['company_id', 'status', 'delivery_date']));

        foreach ([...self::TABLES, 'users'] as $name) {
            Schema::table($name, fn (Blueprint $t) => $t->dropConstrainedForeignId('company_id'));
        }
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['role', 'is_active']));
    }
};
