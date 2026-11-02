<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RouteStop;
use App\Services\RouteService;
use App\Support\CurrentCompany;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Daily delivery routes. Only for companies the super admin switched routes on for;
 * for everyone else these endpoints don't exist (404).
 */
class RouteController extends Controller
{
    public function __construct(private RouteService $routes) {}

    /** Routes are off for this company: the endpoints don't exist. */
    private function enabled(): void
    {
        abort_unless((bool) CurrentCompany::get()?->routes_enabled, 404);
    }

    /** GET /routes?date= — morning and evening progress for the delivery home screen. */
    public function index(Request $request)
    {
        $this->enabled();
        return response()->json($this->routes->summary($this->date($request)));
    }

    /** GET /routes/{session}?date= */
    public function show(Request $request, string $session)
    {
        $this->enabled();
        return response()->json($this->routes->view($this->session($session), $this->date($request)));
    }

    /** POST /routes/{session}/start {date} */
    public function start(Request $request, string $session)
    {
        $this->enabled();
        $session = $this->session($session);
        $date = $this->date($request);
        $this->routes->start($session, $date);

        return response()->json($this->routes->view($session, $date));
    }

    /** POST /routes/{session}/stops {date, customer_id, quantity?} */
    public function add(Request $request, string $session)
    {
        $this->enabled();
        $session = $this->session($session);
        $data = $request->validate([
            'customer_id' => ['required', 'integer'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);
        $date = $this->date($request);
        $this->routes->add($session, $date, (int) $data['customer_id'], $data['quantity'] ?? null);

        return response()->json($this->routes->view($session, $date) + ['message' => __('ग्राहक आजच्या फेरीत जोडला.')], 201);
    }

    /** POST /routes/{session}/order {date, ids[], permanent} */
    public function order(Request $request, string $session)
    {
        $this->enabled();
        $session = $this->session($session);
        $data = $request->validate([
            'ids' => ['required', 'array', 'max:1000'],
            'ids.*' => ['integer'],
            'permanent' => ['sometimes', 'boolean'],
        ]);
        $date = $this->date($request);
        $this->routes->reorder($session, $date, $data['ids'], (bool) ($data['permanent'] ?? false));

        return response()->json($this->routes->view($session, $date) + ['message' => __('क्रम जतन झाला.')]);
    }

    /** PATCH /route-stops/{stop} {status: skipped|pending, skip_reason?, quantity?} */
    public function update(Request $request, RouteStop $stop)
    {
        $this->enabled();
        $data = $request->validate([
            'status' => ['sometimes', Rule::in([RouteStop::PENDING, RouteStop::SKIPPED])],
            'skip_reason' => ['nullable', Rule::in(RouteService::SKIP_REASONS)],
            'quantity' => ['sometimes', 'integer', 'min:1', 'max:1000'],
        ]);
        $this->routes->update($stop, $data);

        return response()->json($this->routes->view($stop->session, $stop->route_date->toDateString()));
    }

    /** DELETE /route-stops/{stop} — off today's route. */
    public function destroy(RouteStop $stop)
    {
        $this->enabled();
        $session = $stop->session;
        $date = $stop->route_date->toDateString();
        $this->routes->remove($stop);

        return response()->json($this->routes->view($session, $date) + ['message' => __('ग्राहक आजच्या फेरीतून काढला.')]);
    }

    private function session(string $session): string
    {
        abort_unless(in_array($session, RouteStop::SESSIONS, true), 404);

        return $session;
    }

    private function date(Request $request): string
    {
        $request->validate(['date' => ['nullable', 'date_format:Y-m-d']]);

        return $request->input('date', RouteService::today());
    }
}
