<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Models\CustomerLedger;
use App\Services\BalanceService;
use App\Services\ReportService;
use Illuminate\Http\Request;
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

    public function store(CustomerRequest $request)
    {
        $customer = Customer::create($request->validated() + ['status' => 'active']);

        return (new CustomerResource($this->row($customer->id)))
            ->additional(['message' => __('ग्राहक यशस्वीरित्या जोडला.')])
            ->response()->setStatusCode(201);
    }

    public function show(Customer $customer)
    {
        return new CustomerResource($this->row($customer->id));
    }

    public function update(CustomerRequest $request, Customer $customer)
    {
        $data = $request->validated();
        // A special price may be cleared (null = default rate); other empty fields keep their value.
        $clearable = array_intersect_key($data, array_flip(['jar_rate', 'bottle_rate']));
        $customer->update(array_filter($data, fn ($v) => $v !== null) + $clearable + ['address' => $request->input('address')]);

        return (new CustomerResource($this->row($customer->id)))
            ->additional(['message' => __('ग्राहक यशस्वीरित्या अपडेट झाला.')]);
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
        $opening = ['balance' => 0.0, 'jar_balance' => 0, 'bottle_balance' => 0, 'deposit_balance' => 0.0];

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
