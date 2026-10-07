<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Follow-up reminders created when jars are given (1 day / 1 week / 15 days).
        Schema::create('reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('jar_transaction_id')->nullable()->constrained('jar_transactions')->nullOnDelete();
            $table->unsignedSmallInteger('days');
            $table->date('remind_on')->index();
            $table->enum('status', ['pending', 'done'])->default('pending')->index();
            $table->boolean('auto_done')->default(false); // closed automatically: no jars and nothing pending
            $table->timestamp('pushed_at')->nullable();   // phone notification sent
            $table->timestamp('read_at')->nullable();     // seen in the app
            $table->timestamp('done_at')->nullable();
            $table->timestamps();
        });

        // Phones/browsers that agreed to receive notifications (Web Push).
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('endpoint', 500)->unique();
            $table->string('p256dh', 200);
            $table->string('auth', 100);
            $table->string('locale', 5)->default('mr');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
        Schema::dropIfExists('reminders');
    }
};
