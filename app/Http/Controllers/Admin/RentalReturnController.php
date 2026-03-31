<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRentalReturnRequest;
use App\Models\PaymentMethodConfig;
use App\Models\Rental;
use App\Models\RentalReturn;
use App\Services\AdminAccessService;
use App\Services\RentalReturnService;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentMethods;
use App\Support\Rental\RentalStatuses;
use App\Support\Rental\ReturnConditions;
use App\Support\Rental\SettlementBases;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RentalReturnController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly RentalReturnService $rentalReturnService,
    ) {}

    public function index(Request $request): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'overdue' => (string) $request->input('overdue', ''),
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];

        $activeRentalsQuery = Rental::query()
            ->with(['customer:id,name,phone_whatsapp', 'items.inventoryUnit.product'])
            ->whereIn('rental_status', [
                RentalStatuses::PICKED_UP,
                RentalStatuses::LATE,
            ])
            ->doesntHave('returnRecord')
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('rental_no', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('customer', function ($customerQuery) use ($filters): void {
                            $customerQuery
                                ->where('name', 'like', '%'.$filters['search'].'%')
                                ->orWhere('phone_whatsapp', 'like', '%'.$filters['search'].'%');
                        });
                });
            })
            ->when($filters['overdue'] !== '', function ($query) use ($filters): void {
                if ($filters['overdue'] === 'yes') {
                    $query->where('due_at', '<', now());
                }

                if ($filters['overdue'] === 'no') {
                    $query->where('due_at', '>=', now());
                }
            });

        $paginatedActiveRentals = $activeRentalsQuery
            ->orderBy('due_at')
            ->paginate($filters['per_page'])
            ->withQueryString();

        $activeRentals = $paginatedActiveRentals->getCollection()
            ->map(fn (Rental $rental) => [
                'id' => $rental->id,
                'rental_no' => $rental->rental_no,
                'customer_name' => $rental->customer?->name,
                'customer_phone' => $rental->customer?->phone_whatsapp,
                'starts_at' => $rental->starts_at?->toIso8601String(),
                'due_at' => $rental->due_at?->toIso8601String(),
                'total_days' => $rental->total_days,
                'subtotal' => (string) $rental->subtotal,
                'paid_amount' => (string) $rental->paid_amount,
                'remaining_amount' => (string) $rental->remaining_amount,
                'guarantee_note' => $rental->guarantee_note,
                'is_overdue' => $rental->due_at !== null && $rental->due_at->isPast(),
                'items' => $rental->items
                    ->map(fn ($item) => [
                        'id' => $item->id,
                        'product_name' => $item->product_name_snapshot,
                        'inventory_unit_code' => $item->inventoryUnit?->unit_code,
                        'daily_rate_snapshot' => (string) $item->daily_rate_snapshot,
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
            'returnFilters' => $filters,
            'returnPagination' => [
                'current_page' => $paginatedActiveRentals->currentPage(),
                'last_page' => $paginatedActiveRentals->lastPage(),
                'per_page' => $paginatedActiveRentals->perPage(),
                'total' => $paginatedActiveRentals->total(),
                'from' => $paginatedActiveRentals->firstItem(),
                'to' => $paginatedActiveRentals->lastItem(),
            ],
            'recentReturns' => $recentReturns,
            'returnSummary' => [
                'active_rentals' => Rental::query()
                    ->whereIn('rental_status', [RentalStatuses::PICKED_UP, RentalStatuses::LATE])
                    ->doesntHave('returnRecord')
                    ->count(),
                'overdue_rentals' => Rental::query()
                    ->whereIn('rental_status', [RentalStatuses::PICKED_UP, RentalStatuses::LATE])
                    ->doesntHave('returnRecord')
                    ->where('due_at', '<', now())
                    ->count(),
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
            'settlementBasisOptions' => SettlementBases::options(),
            'paymentMethodOptions' => PaymentMethodConfig::query()
                ->where('active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get()
                ->map(fn (PaymentMethodConfig $paymentMethodConfig) => [
                    'value' => (string) $paymentMethodConfig->id,
                    'label' => $paymentMethodConfig->name,
                    'type' => $paymentMethodConfig->type,
                    'type_label' => PaymentMethods::label($paymentMethodConfig->type),
                    'instructions' => $paymentMethodConfig->instructions,
                    'bank_name' => $paymentMethodConfig->bank_name,
                    'account_number' => $paymentMethodConfig->account_number,
                    'account_name' => $paymentMethodConfig->account_name,
                    'qr_image_path' => $paymentMethodConfig->qr_image_path,
                ])
                ->values(),
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
