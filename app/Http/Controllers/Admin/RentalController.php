<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRentalRequest;
use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\Rental;
use App\Models\SeasonRule;
use App\Services\AdminAccessService;
use App\Services\RentalCreationService;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentMethods;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RentalController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly RentalCreationService $rentalCreationService,
    ) {}

    public function index(): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $availableUnits = InventoryUnit::query()
            ->with('product:id,name,daily_rate,active')
            ->whereIn('status', [
                InventoryUnitStatuses::READY_CLEAN,
                InventoryUnitStatuses::READY_UNCLEAN,
            ])
            ->whereHas('product', fn ($query) => $query->where('active', true))
            ->orderBy('unit_code')
            ->get()
            ->map(fn (InventoryUnit $inventoryUnit) => [
                'id' => $inventoryUnit->id,
                'product_id' => $inventoryUnit->product_id,
                'product_name' => $inventoryUnit->product?->name,
                'unit_code' => $inventoryUnit->unit_code,
                'status' => $inventoryUnit->status,
                'status_label' => InventoryUnitStatuses::label($inventoryUnit->status),
                'daily_rate' => (string) ($inventoryUnit->product?->daily_rate ?? 0),
                'notes' => $inventoryUnit->notes,
            ])
            ->values();

        $customers = Customer::query()
            ->orderBy('name')
            ->get()
            ->map(fn (Customer $customer) => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone_whatsapp' => $customer->phone_whatsapp,
            ])
            ->values();

        $seasonRules = SeasonRule::query()
            ->where('active', true)
            ->orderBy('start_date')
            ->get()
            ->map(fn (SeasonRule $seasonRule) => [
                'id' => $seasonRule->id,
                'name' => $seasonRule->name,
                'start_date' => $seasonRule->start_date?->toDateString(),
                'end_date' => $seasonRule->end_date?->toDateString(),
                'dp_required' => (bool) $seasonRule->dp_required,
                'dp_type' => $seasonRule->dp_type,
                'dp_value' => $seasonRule->dp_value !== null ? (string) $seasonRule->dp_value : null,
                'notes' => $seasonRule->notes,
            ])
            ->values();

        $recentRentals = Rental::query()
            ->with('customer:id,name')
            ->withCount('items')
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (Rental $rental) => [
                'id' => $rental->id,
                'rental_no' => $rental->rental_no,
                'customer_name' => $rental->customer?->name,
                'starts_at' => $rental->starts_at?->toIso8601String(),
                'due_at' => $rental->due_at?->toIso8601String(),
                'items_count' => $rental->items_count,
                'subtotal' => (string) $rental->subtotal,
                'paid_amount' => (string) $rental->paid_amount,
                'remaining_amount' => (string) $rental->remaining_amount,
                'payment_status' => $rental->payment_status,
                'payment_status_label' => RentalPaymentStatuses::label($rental->payment_status),
                'rental_status' => $rental->rental_status,
                'rental_status_label' => RentalStatuses::label($rental->rental_status),
            ])
            ->values();

        return Inertia::render('admin/rentals/index', [
            'customers' => $customers,
            'availableUnits' => $availableUnits,
            'seasonRules' => $seasonRules,
            'paymentMethodOptions' => PaymentMethods::options(),
            'recentRentals' => $recentRentals,
            'rentalSummary' => [
                'total_available_units' => $availableUnits->count(),
                'ready_clean_units' => $availableUnits->where('status', InventoryUnitStatuses::READY_CLEAN)->count(),
                'ready_unclean_units' => $availableUnits->where('status', InventoryUnitStatuses::READY_UNCLEAN)->count(),
                'active_rentals' => Rental::query()->whereIn('rental_status', [
                    RentalStatuses::BOOKED,
                    RentalStatuses::PICKED_UP,
                    RentalStatuses::LATE,
                ])->count(),
            ],
        ]);
    }

    public function store(StoreRentalRequest $request): RedirectResponse
    {
        $actor = $request->user();
        abort_unless($actor !== null, 403);

        $rental = $this->rentalCreationService->create($actor, $request->validated());

        return to_route('admin.rentals.show', $rental)->with('success', 'Transaksi penyewaan berhasil dibuat.');
    }

    public function show(Rental $rental): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $rental->load([
            'customer',
            'seasonRule',
            'creator',
            'items.inventoryUnit.product',
            'payments.receiver',
        ]);

        return Inertia::render('admin/rentals/show', [
            'rental' => [
                'id' => $rental->id,
                'rental_no' => $rental->rental_no,
                'starts_at' => $rental->starts_at?->toIso8601String(),
                'due_at' => $rental->due_at?->toIso8601String(),
                'total_days' => $rental->total_days,
                'dp_required' => (bool) $rental->dp_required,
                'subtotal' => (string) $rental->subtotal,
                'dp_amount' => (string) $rental->dp_amount,
                'paid_amount' => (string) $rental->paid_amount,
                'remaining_amount' => (string) $rental->remaining_amount,
                'payment_status' => $rental->payment_status,
                'payment_status_label' => RentalPaymentStatuses::label($rental->payment_status),
                'rental_status' => $rental->rental_status,
                'rental_status_label' => RentalStatuses::label($rental->rental_status),
                'notes' => $rental->notes,
                'customer' => [
                    'name' => $rental->customer?->name,
                    'phone_whatsapp' => $rental->customer?->phone_whatsapp,
                    'address' => $rental->customer?->address,
                ],
                'season_rule' => $rental->seasonRule ? [
                    'name' => $rental->seasonRule->name,
                    'dp_required' => (bool) $rental->seasonRule->dp_required,
                ] : null,
                'creator' => [
                    'name' => $rental->creator?->name,
                ],
                'items' => $rental->items
                    ->map(fn ($item) => [
                        'id' => $item->id,
                        'product_name_snapshot' => $item->product_name_snapshot,
                        'inventory_unit_code' => $item->inventoryUnit?->unit_code,
                        'daily_rate_snapshot' => (string) $item->daily_rate_snapshot,
                        'days' => $item->days,
                        'line_total' => (string) $item->line_total,
                        'status_at_checkout' => $item->status_at_checkout,
                        'status_at_checkout_label' => InventoryUnitStatuses::label($item->status_at_checkout),
                    ])
                    ->values(),
                'payments' => $rental->payments
                    ->map(fn ($payment) => [
                        'id' => $payment->id,
                        'amount' => (string) $payment->amount,
                        'payment_kind' => $payment->payment_kind,
                        'paid_at' => $payment->paid_at?->toIso8601String(),
                        'method' => $payment->method,
                        'method_label' => PaymentMethods::label($payment->method),
                        'receiver_name' => $payment->receiver?->name,
                        'notes' => $payment->notes,
                    ])
                    ->values(),
            ],
        ]);
    }
}
