<?php

namespace App\Providers;

use App\Support\CurrentCompany;
use Illuminate\Http\Request;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // One tenant context per request (scoped = reset between requests in long-running workers).
        $this->app->scoped(CurrentCompany::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // The app sends its login token as "Authorization: Bearer …" and also as "X-Auth-Token",
        // because the Vercel proxy in front of the API container does not pass Authorization through.
        Sanctum::getAccessTokenFromRequestUsing(function (Request $request) {
            $token = $request->bearerToken() ?: $request->header('X-Auth-Token');

            // Same format check Sanctum does for bearer tokens: "<numeric id>|<secret>".
            if (! is_string($token) || ! preg_match('/^\d{1,18}\|.+$/', $token)) {
                return null;
            }

            return $token;
        });
    }
}
