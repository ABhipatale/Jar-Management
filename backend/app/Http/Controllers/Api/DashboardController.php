<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JarTransaction;
use App\Services\BookingService;
use App\Services\JarService;
use App\Services\ReminderService;
use Carbon\CarbonImmutable;
use App\Services\ReportService;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request, ReportService $reports, JarService $jars, ReminderService $reminders, BookingService $bookings)
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ], ['to.after_or_equal' => __('शेवटचा दिनांक सुरुवातीच्या दिनांकानंतरचा असावा.')]);

        $today = now()->toDateString();
        $from = $request->input('from', $today);
        $to = $request->input('to', $from);

        $period = $reports->summary($from, $to);

        // Same-length period just before, for "% vs previous period" on the KPI cards.
        $f = CarbonImmutable::parse($from);
        $days = $f->diffInDays(CarbonImmutable::parse($to)) + 1;
        $previous = $reports->summary($f->subDays($days)->toDateString(), $f->subDay()->toDateString());

        // Chart: at least the last 14 days (up to 62) ending on $to.
        $chartFrom = CarbonImmutable::parse($to)->subDays(max(13, min($days - 1, 61)))->toDateString();
        $series = $reports->dailySeries($chartFrom, $to);
        $todaySummary = $from === $today && $to === $today ? $period : $reports->summary($today, $today);
        $month = $reports->summary(now()->startOfMonth()->toDateString(), $today);

        $recent = JarTransaction::with('customer:id,name,mobile')
            ->whereBetween('transaction_date', [$from, $to])
            ->latest('id')->limit(20)->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'customer_name' => $t->customer?->name,
                'transaction_date' => $t->transaction_date->toDateString(),
                'transaction_type' => $t->transaction_type,
                'jar_quantity' => $t->jar_quantity,
                'amount' => $t->amount,
                'paid' => round($t->paid_amount + $t->advance_amount, 2),
                'udhari' => $t->udhari_amount,
            ]);

        $stock = $jars->summary();

        return response()->json([
            'from' => $from,
            'to' => $to,
            'stock' => $stock,
            'previous' => $previous,
            'series' => $series,
            // "Needs attention" panel.
            'attention' => [
                'reminders_due' => $reminders->unreadCount(),
                'bookings_today' => $bookings->summaryFor(),
                'bookings_tomorrow' => $bookings->summaryFor(now()->addDay()->toDateString()),
                'top_pending' => array_slice($reports->pending(), 0, 5),
                'low_stock' => $stock['total_jars'] > 0 && $stock['available_jars'] <= max(5, (int) ceil($stock['total_jars'] * 0.1)),
            ],
            'period' => $period,
            'today' => $todaySummary,
            'month_expenses' => $month['expenses'],
            'customers' => $reports->customerWise($from, $to),
            'recent' => $recent,
        ]);
    }
}
