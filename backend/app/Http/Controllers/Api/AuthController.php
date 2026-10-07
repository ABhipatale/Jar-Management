<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureCompanyAccess;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use App\Services\BillingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request)
    {
        $login = trim($request->input('login'));
        $mobile = preg_replace('/\D/', '', $login);

        $user = User::where('email', mb_strtolower($login))
            ->when(strlen($mobile) >= 10, fn ($q) => $q->orWhere('mobile', substr($mobile, -10)))
            ->first();

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages(['login' => __('ईमेल/मोबाईल किंवा पासवर्ड चुकीचा आहे.')]);
        }

        // Suspended company or disabled user: say why instead of logging in. An expired plan
        // still logs in: the app then shows only the plans, so the company can pay.
        $reason = $user->isSuperAdmin() ? null : EnsureCompanyAccess::blockReason($user);
        if ($reason && $reason !== 'company_expired') {
            throw ValidationException::withMessages(['login' => EnsureCompanyAccess::message($reason)]);
        }
        if ($user->isSuperAdmin() && ! $user->is_active) {
            throw ValidationException::withMessages(['login' => EnsureCompanyAccess::message('user_inactive')]);
        }

        // "Remember me" keeps the phone logged in for 90 days, otherwise 12 hours.
        $expires = $request->boolean('remember') ? now()->addDays(90) : now()->addHours(12);
        $token = $user->createToken('pwa', ['*'], $expires)->plainTextToken;

        return response()->json(['token' => $token, 'user' => self::present($user)]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $impersonating = str_starts_with((string) $user->currentAccessToken()?->name, 'impersonate:');

        return response()->json(['user' => self::present($user, $impersonating)]);
    }

    /** The logged-in user as the app sees it: role + their company (null for the super admin). */
    public static function present(User $user, bool $impersonating = false): array
    {
        $company = $user->company;

        return $user->only('id', 'name', 'email', 'mobile', 'role') + [
            'impersonating' => $impersonating,
            'company' => $company ? [
                'id' => $company->id,
                'name' => $company->name,
                'name_mr' => $company->name_mr,
                'slug' => $company->slug,
                'plan' => $company->plan,
                // The app shows a "please pay" banner during the last days before this date.
                'expires_at' => $company->expires_at?->toDateString(),
                'expired' => $company->isExpired(),
                // Auto-pay is on: no "please pay" reminders needed.
                'auto_renew' => app(BillingService::class)->renewing($company->id) !== null,
            ] : null,
        ];
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => __('लॉगआउट झाले.')]);
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', 'confirmed', Password::min(6)],
        ], [
            'current_password.current_password' => __('सध्याचा पासवर्ड चुकीचा आहे.'),
            'password.confirmed' => __('नवीन पासवर्ड जुळत नाहीत.'),
            'password.min' => __('नवीन पासवर्ड किमान 6 अक्षरांचा असावा.'),
        ]);

        $request->user()->update(['password' => $request->input('password')]);

        return response()->json(['message' => __('पासवर्ड यशस्वीरित्या बदलला.')]);
    }
}
