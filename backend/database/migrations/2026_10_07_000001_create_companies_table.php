<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Each business (tenant) using the app.
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('name_mr', 120)->nullable();
            $table->string('short_name', 40)->nullable();   // installed-app label under the icon
            $table->string('slug', 60)->unique();           // used in public manifest/icon URLs
            $table->string('theme_color', 7)->default('#1d45d8');
            $table->string('background_color', 7)->default('#ffffff');
            $table->string('locale', 5)->default('mr');
            $table->enum('status', ['active', 'suspended'])->default('active')->index();
            $table->string('plan', 40)->nullable();
            $table->timestamp('expires_at')->nullable();    // null = never expires
            $table->unsignedInteger('assets_version')->default(0); // bumps on logo change (icon cache-busting)
            $table->timestamps();
            $table->softDeletes();
        });

        // Logo + generated app icons, stored in the database because the Vercel
        // container's filesystem is temporary. Base64 text works on every database.
        Schema::create('company_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('kind', 20);   // logo, icon-192, icon-512, maskable-512, apple-touch
            $table->string('mime', 40);
            $table->longText('data');     // base64
            $table->timestamps();

            $table->unique(['company_id', 'kind']);
        });

        // What the super admin did (impersonation, suspend, password reset…).
        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->string('action', 40);
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_logs');
        Schema::dropIfExists('company_assets');
        Schema::dropIfExists('companies');
    }
};
