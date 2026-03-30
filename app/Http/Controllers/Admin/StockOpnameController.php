<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRentalStockOpnameRequest;
use App\Http\Requests\Admin\StoreSaleStockOpnameRequest;
use App\Models\InventoryUnit;
use App\Models\SaleProduct;
use App\Models\StockOpnameSession;
use App\Services\AdminAccessService;
use App\Services\StockOpnameService;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\StockOpname\StockOpnameDomains;
use Inertia\Inertia;
use Inertia\Response;

class StockOpnameController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly StockOpnameService $stockOpnameService,
    ) {
    }

    public function index(): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $saleProducts = SaleProduct::query()
            ->orderBy('name')
            ->get()
            ->map(fn (SaleProduct $saleProduct) => [
                'id' => $saleProduct->id,
                'sku' => $saleProduct->sku,
                'name' => $saleProduct->name,
                'category' => $saleProduct->category,
                'stock_qty' => (int) $saleProduct->stock_qty,
                'min_stock_qty' => (int) $saleProduct->min_stock_qty,
                'active' => (bool) $saleProduct->active,
            ])
            ->values();

        $inventoryUnits = InventoryUnit::query()
            ->with('product:id,name')
            ->orderBy('unit_code')
            ->get()
            ->map(fn (InventoryUnit $inventoryUnit) => [
                'id' => $inventoryUnit->id,
                'product_name' => $inventoryUnit->product?->name,
                'unit_code' => $inventoryUnit->unit_code,
                'status' => $inventoryUnit->status,
                'status_label' => InventoryUnitStatuses::label($inventoryUnit->status),
            ])
            ->values();

        $recentSalesSessions = StockOpnameSession::query()
            ->with('creator:id,name')
            ->where('domain', StockOpnameDomains::SALES)
            ->latest('performed_at')
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(fn (StockOpnameSession $session) => [
                'id' => $session->id,
                'opname_no' => $session->opname_no,
                'performed_at' => $session->performed_at?->toIso8601String(),
                'total_items' => $session->total_items,
                'discrepancy_count' => $session->discrepancy_count,
                'creator_name' => $session->creator?->name,
                'notes' => $session->notes,
            ])
            ->values();

        $recentRentalSessions = StockOpnameSession::query()
            ->with('creator:id,name')
            ->where('domain', StockOpnameDomains::RENTAL)
            ->latest('performed_at')
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(fn (StockOpnameSession $session) => [
                'id' => $session->id,
                'opname_no' => $session->opname_no,
                'performed_at' => $session->performed_at?->toIso8601String(),
                'total_items' => $session->total_items,
                'discrepancy_count' => $session->discrepancy_count,
                'creator_name' => $session->creator?->name,
                'notes' => $session->notes,
            ])
            ->values();

        return Inertia::render('admin/stock-opname/index', [
            'saleProducts' => $saleProducts,
            'inventoryUnits' => $inventoryUnits,
            'inventoryStatusOptions' => InventoryUnitStatuses::options(),
            'recentSalesSessions' => $recentSalesSessions,
            'recentRentalSessions' => $recentRentalSessions,
            'opnameSummary' => [
                'sale_products_count' => $saleProducts->count(),
                'sale_stock_total' => $saleProducts->sum('stock_qty'),
                'inventory_units_count' => $inventoryUnits->count(),
                'inventory_discrepancy_candidate_count' => $inventoryUnits
                    ->whereIn('status', [
                        InventoryUnitStatuses::MAINTENANCE,
                        InventoryUnitStatuses::READY_UNCLEAN,
                    ])
                    ->count(),
            ],
        ]);
    }

    public function storeSales(StoreSaleStockOpnameRequest $request)
    {
        $actor = $request->user();
        abort_unless($actor !== null, 403);

        $session = $this->stockOpnameService->createSalesSession($actor, $request->validated());

        return to_route('admin.stock-opname.index')->with(
            'success',
            sprintf('Stok opname penjualan %s berhasil disimpan. Selisih: %d item.', $session->opname_no, $session->discrepancy_count),
        );
    }

    public function storeRentals(StoreRentalStockOpnameRequest $request)
    {
        $actor = $request->user();
        abort_unless($actor !== null, 403);

        $session = $this->stockOpnameService->createRentalSession($actor, $request->validated());

        return to_route('admin.stock-opname.index')->with(
            'success',
            sprintf('Stok opname rental %s berhasil disimpan. Selisih status: %d unit.', $session->opname_no, $session->discrepancy_count),
        );
    }
}
