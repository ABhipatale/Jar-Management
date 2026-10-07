<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(private ReportService $reports) {}

    /** ?date=YYYY-MM-DD */
    public function daily(Request $request)
    {
        $this->validateCommon($request, ['date' => ['nullable', 'date_format:Y-m-d']]);
        $d = $request->input('date', now()->toDateString());

        return $this->period($request, $d, $d);
    }

    /** ?date= any day in the week (Mon–Sun) */
    public function weekly(Request $request)
    {
        $this->validateCommon($request, ['date' => ['nullable', 'date_format:Y-m-d']]);
        [$from, $to] = ReportService::weekRange($request->input('date'));

        return $this->period($request, $from, $to);
    }

    /** ?month=YYYY-MM */
    public function monthly(Request $request)
    {
        $this->validateCommon($request, ['month' => ['nullable', 'date_format:Y-m']]);
        [$from, $to] = ReportService::monthRange($request->input('month'));

        return $this->period($request, $from, $to);
    }

    /** Udhari given in a date range, customer-wise. ?from&to */
    public function udhari(Request $request)
    {
        [$from, $to] = $this->range($request);
        $rows = array_values(array_filter(
            $this->reports->customerWise($from, $to, $this->customerId($request), $request->input('search')),
            fn ($r) => $r['udhari'] > 0 || $r['payments'] > 0
        ));

        return response()->json([
            'from' => $from,
            'to' => $to,
            'summary' => $this->reports->summary($from, $to, $this->customerId($request)),
            'customers' => $rows,
        ]);
    }

    /** Day-wise cash book. ?from&to */
    public function cash(Request $request)
    {
        [$from, $to] = $this->range($request);

        return response()->json([
            'from' => $from,
            'to' => $to,
            'summary' => $this->reports->summary($from, $to),
            'days' => $this->reports->cashBook($from, $to),
        ]);
    }

    public function pending(Request $request)
    {
        $this->validateCommon($request);
        $rows = $this->reports->pending($request->input('search'), $this->customerId($request));

        return response()->json([
            'total' => round(array_sum(array_column($rows, 'pending_amount')), 2),
            'customers' => $rows,
        ]);
    }

    public function jarStatus(Request $request)
    {
        $this->validateCommon($request);

        return response()->json($this->reports->jarStatus($request->input('search'), $this->customerId($request)));
    }

    private function period(Request $request, string $from, string $to)
    {
        $cid = $this->customerId($request);

        return response()->json([
            'from' => $from,
            'to' => $to,
            'summary' => $this->reports->summary($from, $to, $cid),
            'customers' => $this->reports->customerWise($from, $to, $cid, $request->input('search')),
        ]);
    }

    private function range(Request $request): array
    {
        $this->validateCommon($request, [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to = $request->input('to', now()->toDateString());

        return [$from, $to];
    }

    private function validateCommon(Request $request, array $extra = []): void
    {
        $request->validate($extra + [
            'customer_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:100'],
        ], ['to.after_or_equal' => __('शेवटचा दिनांक सुरुवातीच्या दिनांकानंतरचा असावा.')]);
    }

    private function customerId(Request $request): ?int
    {
        return $request->filled('customer_id') ? (int) $request->input('customer_id') : null;
    }
}
