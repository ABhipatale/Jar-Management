<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\User;
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

        // "Remember me" keeps the phone logged in for 90 days, otherwise 12 hours.
        $expires = $request->boolean('remember') ? now()->addDays(90) : now()->addHours(12);
        $token = $user->createToken('pwa', ['*'], $expires)->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->only('id', 'name', 'email', 'mobile'),
        ]);
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $request->user()->only('id', 'name', 'email', 'mobile')]);
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
