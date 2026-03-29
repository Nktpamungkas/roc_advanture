<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProcessInventoryCleaningRequest;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Services\AdminAccessService;
use App\Services\InventoryCleaningService;
use App\Support\Rental\InventoryUnitStatuses;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WashingController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly InventoryCleaningService $inventoryCleaningService,
    ) {}

    public function index(Request $request): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'product' => (string) $request->input('product', ''),
            'per_page' => in_array($request->integer('per_page', 15), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 15)
                : 15,
        ];

        $dirtyUnitsQuery = InventoryUnit::query()
            ->with('product:id,name')
            ->where('status', InventoryUnitStatuses::READY_UNCLEAN)
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('unit_code', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('product', function ($productQuery) use ($filters): void {
                            $productQuery->where('name', 'like', '%'.$filters['search'].'%');
                        });
                });
            })
            ->when($filters['product'] !== '', fn ($query) => $query->where('product_id', $filters['product']));

        $paginatedDirtyUnits = $dirtyUnitsQuery
            ->orderBy('unit_code')
            ->paginate($filters['per_page'])
            ->withQueryString();

        $dirtyUnits = $paginatedDirtyUnits->getCollection()
            ->map(fn (InventoryUnit $inventoryUnit) => [
                'id' => $inventoryUnit->id,
                'product_name' => $inventoryUnit->product?->name,
                'unit_code' => $inventoryUnit->unit_code,
                'notes' => $inventoryUnit->notes,
            ])
            ->values();

        return Inertia::render('admin/washing/index', [
            'dirtyUnits' => $dirtyUnits,
            'washingFilters' => $filters,
            'washingPagination' => [
                'current_page' => $paginatedDirtyUnits->currentPage(),
                'last_page' => $paginatedDirtyUnits->lastPage(),
                'per_page' => $paginatedDirtyUnits->perPage(),
                'total' => $paginatedDirtyUnits->total(),
                'from' => $paginatedDirtyUnits->firstItem(),
                'to' => $paginatedDirtyUnits->lastItem(),
            ],
            'washingSummary' => [
                'total_dirty_units' => InventoryUnit::query()
                    ->where('status', InventoryUnitStatuses::READY_UNCLEAN)
                    ->count(),
                'filtered_dirty_units' => $paginatedDirtyUnits->total(),
                'products_with_dirty_units' => Product::query()
                    ->whereHas('inventoryUnits', fn ($query) => $query->where('status', InventoryUnitStatuses::READY_UNCLEAN))
                    ->count(),
            ],
            'productOptions' => Product::query()
                ->whereHas('inventoryUnits', fn ($query) => $query->where('status', InventoryUnitStatuses::READY_UNCLEAN))
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Product $product) => [
                    'value' => (string) $product->id,
                    'label' => $product->name,
                ])
                ->values(),
        ]);
    }

    public function store(ProcessInventoryCleaningRequest $request): RedirectResponse
    {
        $cleanedCount = $this->inventoryCleaningService->markAsClean($request->validated('unit_ids'));

        return to_route('admin.washing.index')->with(
            'success',
            $cleanedCount.' unit inventaris berhasil ditandai sudah dicuci.',
        );
    }
}
