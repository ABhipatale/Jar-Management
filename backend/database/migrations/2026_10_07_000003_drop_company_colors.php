<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Every company uses the app's own design and colours; only name and logo differ. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['theme_color', 'background_color']);
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('theme_color', 7)->default('#1d45d8')->after('slug');
            $table->string('background_color', 7)->default('#ffffff')->after('theme_color');
        });
    }
};
