<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Picks the language for API messages from the `X-Locale` header sent by the app.
 * `en` → English, `mr` → Marathi; anything else keeps the configured default (Marathi).
 */
class SetLocale
{
    public const SUPPORTED = ['mr', 'en'];

    /** The configured default, remembered before any request changes it (setLocale also rewrites config). */
    private static ?string $default = null;

    public function handle(Request $request, Closure $next): Response
    {
        self::apply($request);

        return $next($request);
    }

    /** Also used by the exception renderer, which can run before/without route middleware. */
    public static function apply(Request $request): void
    {
        self::$default ??= (string) config('app.locale', 'mr');
        $locale = strtolower(trim((string) $request->header('X-Locale', '')));

        // Reset to the configured default when the header is missing/unknown, so a
        // previous request's language never leaks into this one.
        app()->setLocale(in_array($locale, self::SUPPORTED, true) ? $locale : self::$default);
    }
}
