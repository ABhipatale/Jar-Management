<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jar;
use App\Services\JarService;
use App\Support\CurrentCompany;
use App\Support\Products;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Stock is per product: ?product=jar|bottle (jar when not sent). */
class JarController extends Controller
{
    public function __construct(private JarService $jars) {}

    private function product(Request $request): string
    {
        $request->validate(['product' => ['nullable', Rule::in(Products::enabled())]], [
            'product.in' => __('ही वस्तू तुमच्या खात्यात चालू नाही.'),
        ]);

        return $request->input('product') ?: Products::JAR;
    }

    /** Stock summary + (when tracking individual jars) the jar list. */
    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in(Jar::STATUSES)]]);
        $product = $this->product($request);

        $list = Jar::with('customer:id,name')
            ->where('product', $product)
            ->when($request->input('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->input('search'), fn ($q, $v) => $q->where('jar_number', 'like', '%'.strtoupper($v).'%'))
            ->orderBy('id')
            ->paginate(100);

        $list->getCollection()->transform(fn ($j) => [
            'id' => $j->id,
            'jar_number' => $j->jar_number,
            'product' => $j->product,
            'status' => $j->status,
            'customer_id' => $j->customer_id,
            'customer_name' => $j->customer?->name,
            'status_date' => $j->status_date?->toDateString(),
        ]);

        return response()->json(['summary' => $this->jars->summary($product), 'jars' => $list]);
    }

    /**
     * Just the stock numbers (used by Daily Entry to show available jars). The top level is
     * the requested product; by_product has every product the company sells.
     */
    public function summary(Request $request)
    {
        $product = $this->product($request);
        $all = [];
        foreach (Products::enabled() as $p) {
            $all[$p] = $this->jars->summary($p);
        }

        return response()->json($all[$product] + ['by_product' => $all]);
    }

    /** Add new jars (or bottles) to stock. */
    public function store(Request $request)
    {
        $product = $this->product($request);
        $data = $request->validate(['quantity' => ['required', 'integer', 'min:1', 'max:5000']], [
            'quantity.min' => __('संख्या किमान 1 असावी.'),
        ]);
        $this->jars->addJars($data['quantity'], $product);

        return response()->json([
            'message' => Products::msg($product, ':qty जार जोडले.', ':qty बाटल्या जोडल्या.', ['qty' => $data['quantity']]),
            'summary' => $this->jars->summary($product),
        ], 201);
    }

    /** Quantity-based: mark N jars damaged / lost, or bring N back (repaired / found). */
    public function adjust(Request $request)
    {
        $product = $this->product($request);
        $data = $request->validate([
            'action' => ['required', 'in:damaged,lost,repaired,found'],
            'quantity' => ['required', 'integer', 'min:1', 'max:5000'],
            'date' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
        ], ['quantity.min' => __('संख्या किमान 1 असावी.')]);

        $this->jars->adjust($data['action'], $data['quantity'], $data['date'] ?? now()->toDateString(), $product);

        return response()->json(['message' => __('जार स्टॉक अपडेट झाला.'), 'summary' => $this->jars->summary($product)]);
    }

    /** Individual tracking: change one jar's status. */
    public function update(Request $request, Jar $jar)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(Jar::STATUSES)],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where('company_id', CurrentCompany::id())->whereNull('deleted_at')],
        ], ['status.in' => __('चुकीची जार स्थिती.')]);

        $this->jars->setStatus($jar, $data['status'], $data['customer_id'] ?? null);

        return response()->json(['message' => __('जार अपडेट झाला.'), 'summary' => $this->jars->summary($jar->product)]);
    }
}
