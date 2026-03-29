<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BulkGenerateInventoryUnitsRequest;
use App\Http\Requests\Admin\UpsertInventoryUnitRequest;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Services\AdminAccessService;
use App\Services\InventoryUnitCodeService;
use App\Support\Rental\InventoryUnitStatuses;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InventoryUnitController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly InventoryUnitCodeService $inventoryUnitCodeService,
    ) {
    }

    public function index(Request $request): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'product' => (string) $request->input('product', ''),
            'status' => (string) $request->input('status', ''),
            'per_page' => in_array($request->integer('per_page', 15), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 15)
                : 15,
        ];

        $inventoryUnitQuery = InventoryUnit::query()
            ->with('product')

            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('unit_code', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('product', function ($productQuery) use ($filters): void {
                            $productQuery->where('name', 'like', '%'.$filters['search'].'%');
                        });
                });
            })
            ->when($filters['product'] !== '', fn ($query) => $query->where('product_id', $filters['product']))
            ->when($filters['status'] !== '', fn ($query) => $query->where('status', $filters['status']));

        $paginatedInventoryUnits = $inventoryUnitQuery
            ->orderBy('unit_code')
            ->paginate($filters['per_page'])
            ->withQueryString();

        $inventoryUnits = $paginatedInventoryUnits->getCollection()
            ->map(fn (InventoryUnit $inventoryUnit) => [
                'id' => $inventoryUnit->id,
                'product_id' => $inventoryUnit->product_id,
                'product_name' => $inventoryUnit->product?->name,
                'unit_code' => $inventoryUnit->unit_code,
                'status' => $inventoryUnit->status,
                'status_label' => InventoryUnitStatuses::label($inventoryUnit->status),
                'notes' => $inventoryUnit->notes,
            ])
            ->values();

        $statusCounts = InventoryUnit::query()
            ->select('status', DB::raw('count(*) as aggregate'))
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $productOptions = Product::query()
            ->with('inventoryUnits:id,product_id,unit_code')
            ->orderBy('name')
            ->get()
            ->map(fn (Product $product) => [
                'value' => (string) $product->id,
                'label' => $product->active ? $product->name : $product->name.' (Nonaktif)',
                'prefix_code' => $product->prefix_code,
                'next_number' => $this->inventoryUnitCodeService->nextSequenceFromCodes(
                    $product->inventoryUnits->pluck('unit_code')->all(),
                    $product->prefix_code,
                ),
            ])
            ->values();

        return Inertia::render('admin/inventory-units/index', [
            'inventoryUnits' => $inventoryUnits,
            'inventoryFilters' => $filters,
            'inventoryPagination' => [
                'current_page' => $paginatedInventoryUnits->currentPage(),
                'last_page' => $paginatedInventoryUnits->lastPage(),
                'per_page' => $paginatedInventoryUnits->perPage(),
                'total' => $paginatedInventoryUnits->total(),
                'from' => $paginatedInventoryUnits->firstItem(),
                'to' => $paginatedInventoryUnits->lastItem(),
            ],
            'inventorySummary' => [
                'total_units' => InventoryUnit::query()->count(),
                'total_products' => Product::query()->count(),
                'filtered_units' => $paginatedInventoryUnits->total(),
                'statuses' => collect(InventoryUnitStatuses::options())
                    ->map(fn (array $option) => [
                        'value' => $option['value'],
                        'label' => $option['label'],
                        'count' => (int) ($statusCounts[$option['value']] ?? 0),
                    ])
                    ->values(),
            ],
            'productOptions' => $productOptions,
            'statusOptions' => InventoryUnitStatuses::options(),
        ]);
    }

    public function store(UpsertInventoryUnitRequest $request): RedirectResponse
    {
        InventoryUnit::create($request->validated());

        return to_route('admin.inventory-units.index')->with('success', 'Unit inventaris berhasil dibuat.');
    }

    public function storeBulk(BulkGenerateInventoryUnitsRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $product = Product::query()->findOrFail($validated['product_id']);

        if (blank($product->prefix_code)) {
            return to_route('admin.inventory-units.index')
                ->withErrors(['product_id' => 'Produk belum punya prefix kode untuk generate unit.'], 'generateInventoryUnits');
        }

        $codes = $this->inventoryUnitCodeService->generateCodes(
            $product,
            (int) $validated['quantity'],
            isset($validated['start_number']) ? (int) $validated['start_number'] : null,
        );

        $existingCodes = $this->inventoryUnitCodeService->findExistingCodes($codes);

        if ($existingCodes !== []) {
            return to_route('admin.inventory-units.index')
                ->withErrors([
                    'start_number' => 'Kode unit bentrok: '.implode(', ', $existingCodes),
                ], 'generateInventoryUnits');
        }

        $now = now();
        InventoryUnit::query()->insert(
            collect($codes)
                ->map(fn (string $code) => [
                    'product_id' => $product->id,
                    'unit_code' => $code,
                    'status' => $validated['status'],
                    'notes' => $validated['notes'] ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
                ->all(),
        );

        return to_route('admin.inventory-units.index')->with('success', count($codes).' unit inventaris berhasil digenerate.');
    }

    public function update(UpsertInventoryUnitRequest $request, InventoryUnit $inventoryUnit): RedirectResponse
    {
        $inventoryUnit->update($request->validated());

        return to_route('admin.inventory-units.index')->with('success', 'Unit inventaris berhasil diperbarui.');
    }
}
