<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\JarController;
use App\Http\Controllers\Api\JarTransactionController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

// Daily reminder job (Vercel Cron). Idempotent: only sends due reminders, each once.
Route::get('/cron/reminders', [NotificationController::class, 'cron'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/me/password', [AuthController::class, 'changePassword']);

    Route::get('/dashboard', DashboardController::class);

    Route::get('/customers/{customer}/ledger', [CustomerController::class, 'ledger']);
    Route::apiResource('customers', CustomerController::class);

    Route::get('/jars', [JarController::class, 'index']);
    Route::get('/jars/summary', [JarController::class, 'summary']);
    Route::post('/jars', [JarController::class, 'store']);
    Route::post('/jars/adjust', [JarController::class, 'adjust']);
    Route::put('/jars/{jar}', [JarController::class, 'update']);

    Route::apiResource('jar-transactions', JarTransactionController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
    Route::apiResource('payments', PaymentController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
    Route::apiResource('expenses', ExpenseController::class)->only(['index', 'store', 'destroy']);

    Route::prefix('reports')->controller(ReportController::class)->group(function () {
        Route::get('/daily', 'daily');
        Route::get('/weekly', 'weekly');
        Route::get('/monthly', 'monthly');
        Route::get('/cash', 'cash');
        Route::get('/udhari', 'udhari');
        Route::get('/pending', 'pending');
        Route::get('/jar-status', 'jarStatus');
    });

    Route::get('/bookings', [BookingController::class, 'index']);
    Route::get('/bookings/today', [BookingController::class, 'today']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::put('/bookings/{booking}', [BookingController::class, 'update']);
    Route::post('/bookings/{booking}/cancel', [BookingController::class, 'cancel']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/count', [NotificationController::class, 'count']);
    Route::post('/notifications/read', [NotificationController::class, 'readAll']);
    Route::post('/notifications/{reminder}/done', [NotificationController::class, 'done']);
    Route::delete('/notifications/{reminder}', [NotificationController::class, 'destroy']);
    Route::get('/push/key', [NotificationController::class, 'pushKey']);
    Route::post('/push/subscribe', [NotificationController::class, 'subscribe']);
    Route::post('/push/unsubscribe', [NotificationController::class, 'unsubscribe']);

    Route::get('/settings', [SettingController::class, 'show']);
    Route::put('/settings', [SettingController::class, 'update']);
});
