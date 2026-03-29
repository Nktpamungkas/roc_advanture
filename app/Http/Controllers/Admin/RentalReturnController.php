<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRentalReturnRequest;
use App\Models\Rental;
use App\Models\RentalReturn;
use App\Services\AdminAccessService;
use App\Services\RentalReturnService;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\RentalStatuses;
use App\Support\Rental\ReturnConditions;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RentalReturnController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly RentalReturnService $rentalReturnService,
    ) {}

    public function index(): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $activeRentals = Rental::query()
            ->with(['customer:id,name,phone_whatsapp', 'items.inventoryUnit.product'])
            ->whereIn('rental_status', [
                RentalStatuses::PICKED_UP,
                RentalStatuses::LATE,
            ])
            ->doesntHave('returnRecord')
            ->orderBy('due_at')
            ->get()
            ->map(fn (Rental $rental) => [
                'id' => $rental->id,
                'rental_no' => $rental->rental_no,
                'customer_name' => $rental->customer?->name,
                'customer_phone' => $rental->customer?->phone_whatsapp,
                'starts_at' => $rental->starts_at?->toIso8601String(),
                'due_at' => $rental->due_at?->toIso8601String(),
                'total_days' => $rental->total_days,
                'subtotal' => (string) $rental->subtotal,
                'remaining_amount' => (string) $rental->remaining_amount,
                'is_overdue' => $rental->due_at !== null && $rental->due_at->isPast(),
                'items' => $rental->items
                    ->map(fn ($item) => [
                        'id' => $item->id,
                        'product_name' => $item->product_name_snapshot,
                        'inventory_unit_code' => $item->inventoryUnit?->unit_code,
                        'status_at_checkout' => $item->status_at_checkout,
                        'status_at_checkout_label' => InventoryUnitStatuses::label($item->status_at_checkout),
                    ])
                    ->values(),
            ])
            ->values();

        $recentReturns = RentalReturn::query()
            ->with(['rental.customer:id,name'])
            ->withCount('items')
            ->latest('returned_at')
            ->limit(10)
            ->get()
            ->map(fn (RentalReturn $returnRecord) => [
                'id' => $returnRecord->id,
                'rental_no' => $returnRecord->rental?->rental_no,
                'customer_name' => $returnRecord->rental?->customer?->name,
                'returned_at' => $returnRecord->returned_at?->toIso8601String(),
                'items_count' => $returnRecord->items_count,
            ])
            ->values();

        return Inertia::render('admin/returns/index', [
            'activeRentals' => $activeRentals,
            'recentReturns' => $recentReturns,
            'returnSummary' => [
                'active_rentals' => $activeRentals->count(),
                'overdue_rentals' => $activeRentals->where('is_overdue', true)->count(),
                'returned_today' => RentalReturn::query()->whereDate('returned_at', today())->count(),
                'rented_units' => Rental::query()
                    ->whereIn('rental_status', [RentalStatuses::PICKED_UP, RentalStatuses::LATE])
                    ->withCount('items')
                    ->get()
                    ->sum('items_count'),
            ],
            'returnStatusOptions' => [
                [
                    'value' => InventoryUnitStatuses::READY_UNCLEAN,
                    'label' => InventoryUnitStatuses::label(InventoryUnitStatuses::READY_UNCLEAN),
                ],
                [
                    'value' => InventoryUnitStatuses::READY_CLEAN,
                    'label' => InventoryUnitStatuses::label(InventoryUnitStatuses::READY_CLEAN),
                ],
                [
                    'value' => InventoryUnitStatuses::MAINTENANCE,
                    'label' => InventoryUnitStatuses::label(InventoryUnitStatuses::MAINTENANCE),
                ],
                [
                    'value' => InventoryUnitStatuses::RETIRED,
                    'label' => InventoryUnitStatuses::label(InventoryUnitStatuses::RETIRED),
                ],
            ],
            'returnConditionLabels' => [
                ReturnConditions::GOOD => ReturnConditions::label(ReturnConditions::GOOD),
                ReturnConditions::DAMAGED => ReturnConditions::label(ReturnConditions::DAMAGED),
            ],
        ]);
    }

    public function store(StoreRentalReturnRequest $request): RedirectResponse
    {
        $actor = $request->user();
        abort_unless($actor !== null, 403);

        $returnRecord = $this->rentalReturnService->process($actor, $request->validated());

        return to_route('admin.returns.index')->with(
            'success',
            'Pengembalian untuk transaksi '.$returnRecord->rental?->rental_no.' berhasil diproses.',
        );
    }
}
