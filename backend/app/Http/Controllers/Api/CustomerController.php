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
            $q->where('current_jars', '>', 0);
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
        $customer->update(array_filter($request->validated(), fn ($v) => $v !== null) + ['address' => $request->input('address')]);

        return (new CustomerResource($this->row($customer->id)))
            ->additional(['message' => __('ग्राहक यशस्वीरित्या अपडेट झाला.')]);
    }

    /** Soft delete. Blocked while the customer still holds jars or owes money. */
    public function destroy(Customer $customer)
    {
        $b = $this->balances->forCustomer($customer->id);
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
        $opening = ['balance' => 0.0, 'jar_balance' => 0];

        if ($from = $request->input('from')) {
            $prev = CustomerLedger::where('customer_id', $customer->id)->where('entry_date', '<', $from)->orderByDesc('id')->first();
            if ($prev) {
                $opening = ['balance' => $prev->balance, 'jar_balance' => $prev->jar_balance];
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
                'description' => $r->description,
            ]),
        ]);
    }

    private function row(int $id): object
    {
        return $this->balances->balancesTable()->where('id', $id)->firstOrFail();
    }
}
