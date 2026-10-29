<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\BillingPayment;
use App\Models\Company;
use App\Models\CompanyAsset;
use App\Models\Customer;
use App\Models\JarTransaction;
use App\Models\Plan;
use App\Models\User;
use App\Services\BalanceService;
use App\Services\BrandingService;
use App\Services\CompanyService;
use App\Services\IconService;
use App\Support\CurrentCompany;
use App\Support\Products;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/** Super-admin panel: register and manage companies. Every change is written to the audit log. */
class CompanyController extends Controller
{
    public function __construct(
        private CompanyService $companies,
        private IconService $icons,
        private BrandingService $branding,
        private BalanceService $balances,
    ) {}

    public function index(Request $request)
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['active', 'suspended', 'expired'])],
        ]);

        $list = Company::query()
            ->when($request->input('search'), fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$s}%")->orWhere('name_mr', 'like', "%{$s}%")->orWhere('slug', 'like', "%{$s}%")))
            ->when($request->input('status') === 'expired', fn ($q) => $q->whereNotNull('expires_at')->where('expires_at', '<=', now()))
            ->when(in_array($request->input('status'), ['active', 'suspended'], true), fn ($q) => $q->where('status', $request->input('status')))
            ->orderBy('name')
            ->get();

        $ids = $list->pluck('id');
        $users = User::whereIn('company_id', $ids)->groupBy('company_id')->selectRaw('company_id, COUNT(*) AS n')->pluck('n', 'company_id');
        $customers = Customer::withoutGlobalScope('company')->whereIn('company_id', $ids)->whereNull('deleted_at')
            ->groupBy('company_id')->selectRaw('company_id, COUNT(*) AS n')->pluck('n', 'company_id');
        $lastActivity = JarTransaction::withoutGlobalScope('company')->whereIn('company_id', $ids)
            ->groupBy('company_id')->selectRaw('company_id, MAX(created_at) AS t')->pluck('t', 'company_id');
        $owners = User::whereIn('company_id', $ids)->where('role', User::OWNER)->orderBy('id')->get()->keyBy('company_id');
        $logos = CompanyAsset::whereIn('company_id', $ids)->where('kind', 'logo')->pluck('company_id')->flip();

        return response()->json(['data' => $list->map(fn (Company $c) => $this->present($c, [
            'users' => (int) ($users[$c->id] ?? 0),
            'customers' => (int) ($customers[$c->id] ?? 0),
            'last_activity_at' => $lastActivity[$c->id] ?? null,
            'owner' => $owners->get($c->id)?->only('id', 'name', 'email', 'mobile'),
            'logo_url' => $logos->has($c->id) ? "/api/companies/{$c->slug}/icons/logo.png?v={$c->assets_version}" : null,
        ]))]);
    }

    /** Dashboard numbers: plan revenue (this month, last 6 months) and the latest payments. */
    public function overview()
    {
        $payments = BillingPayment::withoutGlobalScope('company');
        $start = now()->startOfMonth()->subMonths(5);
        $byMonth = (clone $payments)->where('created_at', '>=', $start)->get(['amount', 'created_at'])
            ->groupBy(fn (BillingPayment $p) => $p->created_at->format('Y-m'))->map->sum('amount');

        $months = collect(range(0, 5))->map(function (int $i) use ($start, $byMonth) {
            $m = $start->copy()->addMonths($i);

            return ['month' => $m->format('Y-m'), 'amount' => (float) ($byMonth[$m->format('Y-m')] ?? 0)];
        });

        return response()->json([
            'revenue' => [
                'total' => (float) (clone $payments)->sum('amount'),
                'this_month' => $months->last()['amount'],
                'last_month' => $months[4]['amount'],
                'payments' => (clone $payments)->count(),
                'months' => $months->values(),
            ],
            'customers' => Customer::withoutGlobalScope('company')->whereNull('deleted_at')->count(),
            'recent_payments' => (clone $payments)->with(['plan:id,name', 'company:id,name,name_mr'])->latest('id')->limit(6)->get()
                ->map(fn (BillingPayment $p) => [
                    'id' => $p->id,
                    'date' => $p->created_at->toDateString(),
                    'amount' => $p->amount,
                    'plan' => $p->plan?->name,
                    'company' => $p->company ? ['id' => $p->company->id, 'name' => $p->company->name_mr ?: $p->company->name] : null,
                ]),
        ]);
    }

    public function show(Company $company)
    {
        return response()->json(['data' => $this->detail($company)]);
    }

    public function store(Request $request)
    {
        // Emails are stored lower-case; compare them the same way.
        if (is_string($request->input('owner_email'))) {
            $request->merge(['owner_email' => mb_strtolower(trim($request->input('owner_email')))]);
        }
        $data = $request->validate($this->rules() + [
            'owner_name' => ['required', 'string', 'max:120'],
            'owner_email' => ['required', 'email', 'max:120', Rule::unique('users', 'email')],
            'owner_mobile' => ['nullable', 'regex:/^[6-9][0-9]{9}$/', Rule::unique('users', 'mobile')],
            'owner_password' => ['required', Password::min(6)],
            // pending: the owner chooses and pays a plan on first login; paid: the app opens right away.
            'payment' => ['sometimes', Rule::in(['paid', 'pending'])],
        ], $this->messages());

        if (($data['payment'] ?? 'paid') === 'pending') {
            $data['plan_id'] = null;
            $data['expires_at'] = now()->subSecond(); // already "ended": locked until the first payment
        } elseif (! empty($data['plan_id']) && empty($data['expires_at'])) {
            // Paid for a plan, no end date given: one period from today.
            $plan = Plan::findOrFail($data['plan_id']);
            $data['expires_at'] = $plan->interval === 'year' ? now()->startOfDay()->addYear() : now()->startOfDay()->addMonth();
        }
        unset($data['payment']);

        $company = $this->companies->create($this->withPlanName($data));
        $this->audit($request, $company, 'company.created');

        return response()->json(['message' => __('कंपनी नोंदवली.'), 'data' => $this->detail($company)], 201);
    }

    public function update(Request $request, Company $company)
    {
        $owner = $this->owner($company);
        if (is_string($request->input('owner_email'))) {
            $request->merge(['owner_email' => mb_strtolower(trim($request->input('owner_email')))]);
        }
        $data = $request->validate($this->rules($company) + [
            // The owner's login details (email / mobile log in), unique among all users except the owner.
            'owner_name' => ['sometimes', 'required', 'string', 'max:120'],
            'owner_email' => ['sometimes', 'required', 'email', 'max:120', Rule::unique('users', 'email')->ignore($owner->id)],
            'owner_mobile' => ['sometimes', 'nullable', 'regex:/^[6-9][0-9]{9}$/', Rule::unique('users', 'mobile')->ignore($owner->id)],
        ], $this->messages());

        $ownerData = [];
        foreach (['owner_name' => 'name', 'owner_email' => 'email', 'owner_mobile' => 'mobile'] as $in => $col) {
            if (array_key_exists($in, $data)) {
                $ownerData[$col] = $data[$in];
                unset($data[$in]);
            }
        }

        if (array_key_exists('slug', $data)) {
            $data['slug'] = $this->companies->uniqueSlug($data['slug'] ?: $data['name'] ?? $company->name, $company->id);
        }
        $company->update($this->withPlanName($data));
        $this->audit($request, $company, 'company.updated', array_keys($data));

        $owner->fill($ownerData);
        if ($owner->isDirty()) {
            $changed = array_keys($owner->getDirty());
            $owner->save();
            $this->audit($request, $company, 'owner.updated', ['user_id' => $owner->id, 'fields' => $changed]);
        }

        return response()->json(['message' => __('कंपनी बदलली.'), 'data' => $this->detail($company)]);
    }

    public function suspend(Request $request, Company $company)
    {
        $company->update(['status' => Company::SUSPENDED]);
        $this->audit($request, $company, 'company.suspended');

        return response()->json(['message' => __('कंपनी बंद केली.'), 'data' => $this->detail($company)]);
    }

    public function activate(Request $request, Company $company)
    {
        $company->update(['status' => Company::ACTIVE]);
        $this->audit($request, $company, 'company.activated');

        return response()->json(['message' => __('कंपनी सुरू केली.'), 'data' => $this->detail($company)]);
    }

    public function resetOwnerPassword(Request $request, Company $company)
    {
        $data = $request->validate(['password' => ['required', Password::min(6)]], [
            'password.min' => __('नवीन पासवर्ड किमान 6 अक्षरांचा असावा.'),
        ]);
        $owner = $this->owner($company);
        $owner->update(['password' => $data['password']]);
        // Old sessions must log in again with the new password.
        $owner->tokens()->delete();
        $this->audit($request, $company, 'owner.password_reset', ['user_id' => $owner->id]);

        return response()->json(['message' => __('मालकाचा पासवर्ड बदलला.')]);
    }

    public function destroy(Request $request, Company $company)
    {
        DB::transaction(function () use ($company) {
            // Log everyone out; the data stays (soft delete) in case it was a mistake.
            DB::table('personal_access_tokens')->where('tokenable_type', User::class)
                ->whereIn('tokenable_id', $company->users()->pluck('id'))->delete();
            $company->delete();
        });
        $this->audit($request, $company, 'company.deleted');

        return response()->json(['message' => __('कंपनी हटवली.')]);
    }

    /**
     * "Login as company" for support: a short-lived token for the company's owner.
     * The app keeps the super-admin token aside and shows a banner until you exit.
     */
    public function impersonate(Request $request, Company $company)
    {
        $owner = $this->owner($company);
        $token = $owner->createToken('impersonate:'.$request->user()->id, ['*'], now()->addHours(2))->plainTextToken;
        $this->audit($request, $company, 'company.impersonated', ['user_id' => $owner->id]);

        return response()->json([
            'token' => $token,
            'user' => AuthController::present($owner, impersonating: true),
        ]);
    }

    public function uploadLogo(Request $request, Company $company)
    {
        $request->validate(['logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:4096']]);
        $this->icons->store($company, $request->file('logo'));
        $this->audit($request, $company, 'company.logo_changed');

        return response()->json(['message' => __('लोगो जतन झाला.'), 'data' => $this->detail($company)]);
    }

    public function removeLogo(Request $request, Company $company)
    {
        $this->icons->remove($company);
        $this->audit($request, $company, 'company.logo_removed');

        return response()->json(['message' => __('लोगो काढला.'), 'data' => $this->detail($company)]);
    }

    /** GET /admin/audit: what the super admin did recently. */
    public function auditLog()
    {
        $rows = AdminAuditLog::with(['user:id,name,email', 'company:id,name,slug'])->latest('id')->limit(200)->get();

        return response()->json(['data' => $rows]);
    }

    private function audit(Request $request, Company $company, string $action, ?array $meta = null): void
    {
        AdminAuditLog::create([
            'user_id' => $request->user()->id,
            'company_id' => $company->id,
            'action' => $action,
            'meta' => $meta,
        ]);
    }

    /** The chosen plan's name is also kept on the company (shown in lists). */
    private function withPlanName(array $data): array
    {
        if (array_key_exists('plan_id', $data)) {
            $data['plan'] = $data['plan_id'] ? Plan::withTrashed()->find($data['plan_id'])?->name : null;
        }

        return $data;
    }

    private function owner(Company $company): User
    {
        return User::where('company_id', $company->id)->where('role', User::OWNER)->orderBy('id')->firstOrFail();
    }

    private function rules(?Company $company = null): array
    {
        $req = $company ? 'sometimes' : 'required';

        return [
            'name' => [$req, 'string', 'max:120'],
            'name_mr' => ['sometimes', 'nullable', 'string', 'max:120'],
            'short_name' => ['sometimes', 'nullable', 'string', 'max:40'],
            'slug' => ['sometimes', 'nullable', 'alpha_dash:ascii', 'max:60'],
            'locale' => ['sometimes', Rule::in(['mr', 'en'])],
            'plan_id' => ['sometimes', 'nullable', 'integer', Rule::exists('plans', 'id')->whereNull('deleted_at')],
            'expires_at' => ['sometimes', 'nullable', 'date'],
            // Optional features of the business app (off for every company until switched on here).
            'bottles_enabled' => ['sometimes', 'boolean'],
            'deposit_enabled' => ['sometimes', 'boolean'],
        ];
    }

    private function messages(): array
    {
        return [
            'name.required' => __('कृपया कंपनीचे नाव टाका.'),
            'owner_email.unique' => __('हा ईमेल आधीच वापरात आहे.'),
            'owner_mobile.unique' => __('हा मोबाईल नंबर आधीच वापरात आहे.'),
            'owner_mobile.regex' => __('कृपया योग्य 10 अंकी मोबाईल नंबर टाका.'),
            'owner_password.min' => __('नवीन पासवर्ड किमान 6 अक्षरांचा असावा.'),
        ];
    }

    private function present(Company $c, array $extra = []): array
    {
        return $c->only('id', 'name', 'name_mr', 'short_name', 'slug', 'locale', 'status', 'plan', 'plan_id') + [
            'expires_at' => $c->expires_at?->toDateString(),
            'expired' => $c->isExpired(),
            'awaiting_payment' => $c->awaitingFirstPayment(),
            'created_at' => $c->created_at?->toDateString(),
            'bottles_enabled' => (bool) $c->bottles_enabled,
            'deposit_enabled' => (bool) $c->deposit_enabled,
        ] + $extra;
    }

    private function detail(Company $company): array
    {
        $company->refresh();

        return $this->present($company, [
            'owner' => User::where('company_id', $company->id)->where('role', User::OWNER)->orderBy('id')->first()?->only('id', 'name', 'email', 'mobile'),
            'users' => User::where('company_id', $company->id)->count(),
            'customers' => Customer::withoutGlobalScope('company')->where('company_id', $company->id)->whereNull('deleted_at')->count(),
            'jar_entries' => JarTransaction::withoutGlobalScope('company')->where('company_id', $company->id)->count(),
            // Still out with customers: shown as a warning before switching bottles / deposit off.
            'outstanding' => CurrentCompany::run($company, fn () => [
                'bottles' => $this->balances->totalCustomerJars(Products::BOTTLE),
                'deposit' => round((float) $this->balances->balancesTable()->sum('deposit_held'), 2),
            ]),
            'last_activity_at' => JarTransaction::withoutGlobalScope('company')->where('company_id', $company->id)->max('created_at'),
            'branding' => $this->branding->forCompany($company),
            'payments' => BillingPayment::withoutGlobalScope('company')->with('plan:id,name')
                ->where('company_id', $company->id)->latest('id')->limit(24)->get()
                ->map(fn (BillingPayment $p) => [
                    'id' => $p->id,
                    'date' => $p->created_at->toDateString(),
                    'plan' => $p->plan?->name,
                    'amount' => $p->amount,
                    'razorpay_payment_id' => $p->razorpay_payment_id,
                    'period_end' => $p->period_end?->toDateString(),
                ]),
        ]);
    }
}
