<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const OLD = 'Diesel,Salary,Electricity,Jar Purchase,Repair,Other';
    private const NEW = 'डिझेल,पगार,वीज बिल,जार खरेदी,दुरुस्ती,इतर';

    // The app is now fully Marathi. Only replace the list if the owner never changed it.
    public function up(): void
    {
        DB::table('settings')->where('key', 'expense_types')->where('value', self::OLD)->update(['value' => self::NEW]);
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'expense_types')->where('value', self::NEW)->update(['value' => self::OLD]);
    }
};
