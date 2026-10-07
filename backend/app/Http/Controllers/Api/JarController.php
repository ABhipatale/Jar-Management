<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jar;
use App\Services\JarService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class JarController extends Controller
{
    public function __construct(private JarService $jars) {}

    /** Stock summary + (when tracking individual jars) the jar list. */
    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in(Jar::STATUSES)]]);

        $list = Jar::with('customer:id,name')
            ->when($request->input('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->input('search'), fn ($q, $v) => $q->where('jar_number', 'like', '%'.strtoupper($v).'%'))
            ->orderBy('id')
            ->paginate(100);

        $list->getCollection()->transform(fn ($j) => [
            'id' => $j->id,
            'jar_number' => $j->jar_number,
            'status' => $j->status,
            'customer_id' => $j->customer_id,
            'customer_name' => $j->customer?->name,
            'status_date' => $j->status_date?->toDateString(),
        ]);

        return response()->json(['summary' => $this->jars->summary(), 'jars' => $list]);
    }

    /** Just the stock numbers (used by Daily Entry to show available jars). */
    public function summary()
    {
        return response()->json($this->jars->summary());
    }

    /** Add new jars to stock. */
    public function store(Request $request)
    {
        $data = $request->validate(['quantity' => ['required', 'integer', 'min:1', 'max:5000']], [
            'quantity.min' => __('संख्या किमान 1 असावी.'),
        ]);
        $this->jars->addJars($data['quantity']);

        return response()->json(['message' => __(':qty जार जोडले.', ['qty' => $data['quantity']]), 'summary' => $this->jars->summary()], 201);
    }

    /** Quantity-based: mark N jars damaged / lost, or bring N back (repaired / found). */
    public function adjust(Request $request)
    {
        $data = $request->validate([
            'action' => ['required', 'in:damaged,lost,repaired,found'],
            'quantity' => ['required', 'integer', 'min:1', 'max:5000'],
            'date' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
        ], ['quantity.min' => __('संख्या किमान 1 असावी.')]);

        $this->jars->adjust($data['action'], $data['quantity'], $data['date'] ?? now()->toDateString());

        return response()->json(['message' => __('जार स्टॉक अपडेट झाला.'), 'summary' => $this->jars->summary()]);
    }

    /** Individual tracking: change one jar's status. */
    public function update(Request $request, Jar $jar)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(Jar::STATUSES)],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
        ], ['status.in' => __('चुकीची जार स्थिती.')]);

        $this->jars->setStatus($jar, $data['status'], $data['customer_id'] ?? null);

        return response()->json(['message' => __('जार अपडेट झाला.'), 'summary' => $this->jars->summary()]);
    }
}
