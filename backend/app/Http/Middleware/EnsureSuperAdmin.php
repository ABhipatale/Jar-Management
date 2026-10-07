<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** /api/admin/*: only the platform owner (super admin). */
class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user?->isSuperAdmin() || ! $user->is_active) {
            return response()->json(['message' => __('ही सुविधा फक्त सुपर ॲडमिनसाठी आहे.')], 403);
        }

        return $next($request);
    }
}
