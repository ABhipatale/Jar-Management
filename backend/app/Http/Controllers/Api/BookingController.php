<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\BookingService;
use App\Support\CurrentCompany;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    public function __construct(private BookingService $bookings) {}

    public function index()
    {
        return response()->json($this->bookings->list());
    }

    /** Today's undelivered bookings (dashboard banner). */
    public function today()
    {
        return response()->json($this->bookings->summaryFor());
    }

    public function store(Request $request)
    {
        $booking = $this->bookings->create($this->validated($request, true));

        return response()->json(['message' => __('बुकिंग नोंदवली.'), 'data' => $booking->load('customer:id,name,mobile')], 201);
    }

    public function update(Request $request, Booking $booking)
    {
        $this->mustBeOpen($booking);
        $booking = $this->bookings->update($booking, $this->validated($request, false));

        return response()->json(['message' => __('बुकिंग बदलली.'), 'data' => $booking]);
    }

    public function cancel(Booking $booking)
    {
        $this->mustBeOpen($booking);
        $booking->update(['status' => 'cancelled']);

        return response()->json(['message' => __('बुकिंग रद्द केली.')]);
    }

    private function validated(Request $request, bool $withCustomer): array
    {
        return $request->validate(array_filter([
            'customer_id' => $withCustomer ? ['required', 'integer', Rule::exists('customers', 'id')->where('company_id', CurrentCompany::id())->whereNull('deleted_at')] : null,
            'delivery_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'jar_quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]), [
            'customer_id.required' => __('कृपया ग्राहक निवडा.'),
            'delivery_date.required' => __('कृपया डिलिव्हरीची तारीख निवडा.'),
            'delivery_date.after_or_equal' => __('बुकिंगची तारीख आज किंवा पुढची असावी.'),
            'jar_quantity.required' => __('कृपया जारची संख्या टाका.'),
            'jar_quantity.min' => __('जारची संख्या किमान 1 असावी.'),
        ]);
    }

    private function mustBeOpen(Booking $booking): void
    {
        if ($booking->status !== 'booked') {
            throw ValidationException::withMessages(['booking' => __('ही बुकिंग आधीच पूर्ण किंवा रद्द झाली आहे.')]);
        }
    }
}
