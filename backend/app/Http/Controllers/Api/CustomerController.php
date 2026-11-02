<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Models\CustomerLedger;
use App\Models\Jar;
use App\Services\BalanceService;
use App\Services\JarService;
use App\Services\LedgerService;
use App\Services\ReportService;
use App\Support\Products;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerController extends Controller
{
    public function __construct(private BalanceService $balances) {}

    /** ?search= name/mobile, ?status=active|inactive, ?filter=pending|jars */
    public function index(Request $request, ReportService $reports)
    {
        $q = $this->balances->balancesTable()->orderBy('name');

        if (in_array($request->input('status'), ['active', 'inactive'], true)) {
            $q->where('status', $request->input('status'));
        }
        if ($request->input('filter') === 'pending') {
            $q->where('pending_amount', '>', 0);
        } elseif ($request->input('filter') === 'jars') {
            $q->where(fn ($w) => $w->where('current_jars', '>', 0)->orWhere('current_bottles', '>', 0));
        }
        $reports->applySearch($q, $request->input('search'));

        return CustomerResource::collection($q->limit(1000)->get());
    }

    public function store(CustomerRequest $request, JarService $jars)
    {
        $data = $this->oldJars($request->validated());
        $data['opening_balance'] = (float) ($data['opening_balance'] ?? 0);
        $data += ['opening_jars' => 0, 'opening_bottles' => 0];
        $customer = DB::transaction(function () use ($data, $jars) {
            $this->checkOldJars($data, null, $jars);

            return Customer::create($data + ['status' => 'active']);
        });

        return (new CustomerResource($this->row($customer->id)))
            ->additional(['message' => __('ग्राहक यशस्वीरित्या जोडला.')])
            ->response()->setStatusCode(201);
    }

    public function show(Customer $customer)
    {
        return new CustomerResource($this->row($customer->id));
    }

    public function update(CustomerRequest $request, Customer $customer, LedgerService $ledger, JarService $jars)
    {
        $data = $this->oldJars($request->validated());
        if (array_key_exists('opening_balance', $data)) {
            $data['opening_balance'] = (float) ($data['opening_balance'] ?? 0);
        }
        // A special price may be cleared (null = default rate); other empty fields keep their value.
        $clearable = array_intersect_key($data, array_flip(['jar_rate', 'bottle_rate', 'delivery_note', 'schedule_days']));
        $before = $customer->only('opening_balance', 'opening_jars', 'opening_bottles');
        DB::transaction(function () use ($customer, $data, $clearable, $request, $before, $ledger, $jars) {
            $this->checkOldJars($data, $customer, $jars);
            $customer->update(array_filter($data, fn ($v) => $v !== null) + $clearable + ['address' => $request->input('address')]);
            // The statement starts from the old udhari / old jars, so rebuild it when they change.
            if (abs((float) $customer->opening_balance - (float) $before['opening_balance']) > 0.004
                || (int) $customer->opening_jars !== (int) $before['opening_jars']
                || (int) $customer->opening_bottles !== (int) $before['opening_bottles']) {
                $ledger->rebuild($customer->id);
            }
        });

        return (new CustomerResource($this->row($customer->id)))
            ->additional(['message' => __('ग्राहक यशस्वीरित्या अपडेट झाला.')]);
    }

    /** Old jars: empty means 0; old bottles only when the company has bottles switched on. */
    private function oldJars(array $data): array
    {
        foreach (['opening_jars', 'opening_bottles'] as $k) {
            if (array_key_exists($k, $data)) {
                $data[$k] = (int) ($data[$k] ?? 0);
            }
        }
        if (! in_array(Products::BOTTLE, Products::enabled(), true)) {
            unset($data['opening_bottles']);
        }

        return $data;
    }

    /**
     * Old jars are the shop's own jars, so an increase must fit in the available stock (like
     * giving jars), and a decrease can't take the customer below zero (jars already returned).
     */
    private function checkOldJars(array $data, ?Customer $customer, JarService $jars): void
    {
        Jar::query()->lockForUpdate()->pluck('id'); // same lock as jar entries: no double-booking stock
        foreach ([Products::JAR => 'opening_jars', Products::BOTTLE => 'opening_bottles'] as $product => $key) {
            if (! array_key_exists($key, $data)) {
                continue;
            }
            $change = (int) $data[$key] - (int) ($customer?->{$key} ?? 0);
            if ($change > 0) {
                $available = $jars->summary($product)['available_jars'];
                if ($change > $available) {
                    throw ValidationException::withMessages([$key => Products::msg($product,
                        'दुकानात फक्त :n जार उपलब्ध आहेत. जुने जार दुकानाच्या एकूण जारमधूनच येतात – आधी सेटिंग्जमध्ये एकूण जार वाढवा.',
                        'दुकानात फक्त :n बाटल्या उपलब्ध आहेत. जुन्या बाटल्या दुकानाच्या एकूण बाटल्यांमधूनच येतात – आधी सेटिंग्जमध्ये एकूण बाटल्या वाढवा.',
                        ['n' => max(0, $available)])]);
                }
            } elseif ($change < 0 && $customer) {
                $held = $this->balances->forCustomer($customer->id)['held'][$product];
                if ($held + $change < 0) {
                    throw ValidationException::withMessages([$key => Products::msg($product,
                        'ग्राहकाकडे सध्या :n जार आहेत. जुने जार इतके कमी करता येणार नाहीत.',
                        'ग्राहकाकडे सध्या :n बाटल्या आहेत. जुन्या बाटल्या इतक्या कमी करता येणार नाहीत.',
                        ['n' => $held])]);
                }
            }
        }
    }

    /** Soft delete. Blocked while the customer still holds jars/bottles, owes money or has a deposit. */
    public function destroy(Customer $customer)
    {
        $b = $this->balances->forCustomer($customer->id);
        if ($b['current_bottles'] > 0 || $b['deposit_held'] > 0.004) {
            throw ValidationException::withMessages([
                'customer' => __('हटवता येत नाही: ग्राहकाकडे :bottles बाटल्या आहेत आणि ₹:deposit डिपॉझिट जमा आहे. आधी हिशोब पूर्ण करा, किंवा ग्राहकाला निष्क्रिय करा.', [
                    'bottles' => $b['current_bottles'],
                    'deposit' => number_format($b['deposit_held'], 2),
                ]),
            ]);
        }
        if ($b['current_jars'] > 0 || abs($b['pending']) > 0.004) {
            throw ValidationException::withMessages([
                'customer' => __('हटवता येत नाही: ग्राहकाकडे :jars जार आणि ₹:pending बाकी आहे. आधी हिशोब पूर्ण करा, किंवा ग्राहकाला निष्क्रिय करा.', [
                    'jars' => $b['current_jars'],
                    'pending' => number_format($b['pending'], 2),
                ]),
            ]);
        }
        $customer->delete();

        return response()->json(['message' => __('ग्राहक हटवला.')]);
    }

    /** Statement with running balance. Optional ?from=&to= */
    public function ledger(Request $request, Customer $customer)
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $q = CustomerLedger::where('customer_id', $customer->id)->orderBy('id');
        $opening = ['balance' => (float) $customer->opening_balance, 'jar_balance' => (int) $customer->opening_jars, 'bottle_balance' => (int) $customer->opening_bottles, 'deposit_balance' => 0.0];

        if ($from = $request->input('from')) {
            $prev = CustomerLedger::where('customer_id', $customer->id)->where('entry_date', '<', $from)->orderByDesc('id')->first();
            if ($prev) {
                $opening = $prev->only('balance', 'jar_balance', 'bottle_balance', 'deposit_balance');
            }
            $q->where('entry_date', '>=', $from);
        }
        if ($to = $request->input('to')) {
            $q->where('entry_date', '<=', $to);
        }

        return response()->json([
            'customer' => new CustomerResource($this->row($customer->id)),
            'opening' => $opening,
            'rows' => $q->get()->map(fn ($r) => [
                'id' => $r->id,
                'entry_date' => $r->entry_date->toDateString(),
                'entry_type' => $r->entry_type,
                'product' => $r->product,
                'jar_transaction_id' => $r->jar_transaction_id,
                'payment_id' => $r->payment_id,
                'jars_given' => $r->jars_given,
                'jars_returned' => $r->jars_returned,
                'net_jars' => $r->jars_given - $r->jars_returned,
                'amount' => $r->amount,
                'paid' => $r->paid,
                'udhari' => $r->udhari,
                'balance' => $r->balance,
                'jar_balance' => $r->jar_balance,
                'deposit' => $r->deposit,
                'bottle_balance' => $r->bottle_balance,
                'deposit_balance' => $r->deposit_balance,
                'description' => $r->description,
            ]),
        ]);
    }

    private function row(int $id): object
    {
        return $this->balances->balancesTable()->where('id', $id)->firstOrFail();
    }
}
