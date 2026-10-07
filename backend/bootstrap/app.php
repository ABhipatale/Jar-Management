<?php

use App\Http\Middleware\SetLocale;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Behind Vercel's proxy: use the real client IP (login throttling) and https scheme.
        $middleware->trustProxies(at: '*');

        // Language of API messages: X-Locale header (mr = default, en = English).
        $middleware->api(prepend: [SetLocale::class]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // The app only ever shows short, friendly messages — never PHP/Laravel internals.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            // Errors can be thrown before the api middleware ran (e.g. unknown route), so
            // apply the request's language here too.
            SetLocale::apply($request);

            if ($e instanceof ValidationException) {
                $errors = $e->errors();

                return response()->json([
                    'message' => collect($errors)->flatten()->first() ?: __('कृपया फॉर्म तपासा.'),
                    'errors' => $errors,
                ], 422);
            }
            if ($e instanceof AuthenticationException) {
                return response()->json(['message' => __('कृपया पुन्हा लॉगिन करा.')], 401);
            }
            if ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
                return response()->json(['message' => __('नोंद सापडली नाही.')], 404);
            }
            if ($e instanceof ThrottleRequestsException) {
                return response()->json(['message' => __('खूप जास्त प्रयत्न झाले. कृपया एक मिनिट थांबून पुन्हा प्रयत्न करा.')], 429);
            }
            if ($e instanceof HttpExceptionInterface && $e->getStatusCode() < 500) {
                return response()->json(['message' => __('काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.')], $e->getStatusCode());
            }

            // Already logged by Laravel's reporter.
            return response()->json(['message' => __('काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.')], 500);
        });
    })->create();
