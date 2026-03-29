<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpsertInventoryUnitRequest;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Services\AdminAccessService;
use App\Support\Rental\InventoryUnitStatuses;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class InventoryUnitController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
    ) {
    }

    public function index(): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $inventoryUnits = InventoryUnit::query()
            ->with('product')
            ->orderBy('unit_code')
            ->get()
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

        $productOptions = Product::query()
            ->orderBy('name')
            ->get()
            ->map(fn (Product $product) => [
                'value' => (string) $product->id,
                'label' => $product->active ? $product->name : $product->name.' (Nonaktif)',
            ])
            ->values();

        return Inertia::render('admin/inventory-units/index', [
            'inventoryUnits' => $inventoryUnits,
            'productOptions' => $productOptions,
            'statusOptions' => InventoryUnitStatuses::options(),
        ]);
    }

    public function store(UpsertInventoryUnitRequest $request): RedirectResponse
    {
        InventoryUnit::create($request->validated());

        return to_route('admin.inventory-units.index')->with('success', 'Unit inventaris berhasil dibuat.');
    }

    public function update(UpsertInventoryUnitRequest $request, InventoryUnit $inventoryUnit): RedirectResponse
    {
        $inventoryUnit->update($request->validated());

        return to_route('admin.inventory-units.index')->with('success', 'Unit inventaris berhasil diperbarui.');
    }
}
