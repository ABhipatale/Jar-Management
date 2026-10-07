<?php

namespace App\Http\Middleware;

use App\Models\Company;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Business routes: only an active user of an active, non-expired company gets in.
 * (The super admin has no company, so they use /api/admin/* or "Login as company".)
 */
class EnsureCompanyAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $reason = self::blockReason($user);
        // An expired plan only closes the app, not the plan & payment screen.
        if ($reason === 'company_expired' && $request->routeIs('billing.*')) {
            return $next($request);
        }
        if ($reason) {
            return response()->json(['message' => self::message($reason), 'code' => $reason], 403);
        }

        return $next($request);
    }

    /** null when the user may use the business app; otherwise why not. */
    public static function blockReason(?User $user): ?string
    {
        if (! $user || ! $user->is_active) {
            return 'user_inactive';
        }
        $company = $user->company;
        if (! $company) {
            return 'no_company';
        }
        if ($company->status !== Company::ACTIVE || $company->trashed()) {
            return 'company_suspended';
        }
        if ($company->isExpired()) {
            return 'company_expired';
        }

        return null;
    }

    public static function message(string $reason): string
    {
        return match ($reason) {
            'company_suspended' => __('तुमच्या कंपनीचे खाते बंद केले आहे. कृपया सपोर्टशी संपर्क करा.'),
            'company_expired' => __('तुमचा प्लॅन संपला आहे. पुढे वापरण्यासाठी कृपया प्लॅन निवडून पेमेंट करा.'),
            'no_company' => __('हे खाते कोणत्याही कंपनीशी जोडलेले नाही.'),
            default => __('हे खाते बंद केले आहे.'),
        };
    }
}
