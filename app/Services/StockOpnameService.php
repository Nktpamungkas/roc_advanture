<?php

namespace App\Services;

use App\Models\InventoryUnit;
use App\Models\SaleProduct;
use App\Models\StockOpnameSession;
use App\Models\User;
use App\Support\Sales\StockMovementTypes;
use App\Support\StockOpname\StockOpnameDomains;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockOpnameService
{
    public function __construct(
        private readonly SaleStockMovementService $saleStockMovementService,
    ) {
    }

    public function createSalesSession(User $actor, array $validated): StockOpnameSession
    {
        return DB::transaction(function () use ($actor, $validated): StockOpnameSession {
            $performedAt = Carbon::parse($validated['performed_at']);
            $productIds = collect($validated['items'])
                ->pluck('sale_product_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();

            $products = SaleProduct::query()
                ->whereIn('id', $productIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($products->count() !== $productIds->count()) {
                throw ValidationException::withMessages([
                    'items' => 'Beberapa produk jual tidak ditemukan lagi. Silakan refresh halaman.',
                ]);
            }

            $rows = collect($validated['items'])->map(function (array $row) use ($products) {
                /** @var SaleProduct $product */
                $product = $products->get((int) $row['sale_product_id']);
                $systemQty = (int) $product->stock_qty;
                $physicalQty = (int) $row['physical_qty'];

                return [
                    'product' => $product,
                    'system_qty' => $systemQty,
                    'physical_qty' => $physicalQty,
                    'difference_qty' => $physicalQty - $systemQty,
                    'notes' => $row['notes'] ?? null,
                ];
            });

            $session = StockOpnameSession::query()->create([
                'opname_no' => $this->generateOpnameNumber(StockOpnameDomains::SALES),
                'domain' => StockOpnameDomains::SALES,
                'performed_at' => $performedAt,
                'created_by' => $actor->id,
                'total_items' => $rows->count(),
                'discrepancy_count' => $rows->where('difference_qty', '!=', 0)->count(),
                'notes' => $validated['notes'] ?? null,
            ]);

            $session->saleItems()->createMany(
                $rows->map(fn (array $row) => [
                    'sale_product_id' => $row['product']->id,
                    'sku_snapshot' => $row['product']->sku,
                    'product_name_snapshot' => $row['product']->name,
                    'system_qty' => $row['system_qty'],
                    'physical_qty' => $row['physical_qty'],
                    'difference_qty' => $row['difference_qty'],
                    'notes' => $row['notes'],
                ])->all(),
            );

            $rows
                ->filter(fn (array $row) => $row['difference_qty'] !== 0)
                ->each(function (array $row) use ($session, $validated): void {
                    /** @var SaleProduct $product */
                    $product = $row['product'];
                    $stockBefore = $row['system_qty'];
                    $stockAfter = $row['physical_qty'];

                    $product->update([
                        'stock_qty' => $stockAfter,
                    ]);

                    $this->saleStockMovementService->record(
                        saleProduct: $product,
                        referenceType: 'stock_opname',
                        referenceId: $session->id,
                        movementType: StockMovementTypes::ADJUSTMENT,
                        qty: abs($row['difference_qty']),
                        stockBefore: $stockBefore,
                        stockAfter: $stockAfter,
                        notes: $row['notes'] ?: ($validated['notes'] ?? null),
                    );
                });

            return $session->load(['creator', 'saleItems']);
        });
    }

    public function createRentalSession(User $actor, array $validated): StockOpnameSession
    {
        return DB::transaction(function () use ($actor, $validated): StockOpnameSession {
            $performedAt = Carbon::parse($validated['performed_at']);
            $unitIds = collect($validated['items'])
                ->pluck('inventory_unit_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();

            $inventoryUnits = InventoryUnit::query()
                ->with('product:id,name')
                ->whereIn('id', $unitIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($inventoryUnits->count() !== $unitIds->count()) {
                throw ValidationException::withMessages([
                    'items' => 'Beberapa unit inventaris tidak ditemukan lagi. Silakan refresh halaman.',
                ]);
            }

            $rows = collect($validated['items'])->map(function (array $row) use ($inventoryUnits) {
                /** @var InventoryUnit $inventoryUnit */
                $inventoryUnit = $inventoryUnits->get((int) $row['inventory_unit_id']);

                return [
                    'inventory_unit' => $inventoryUnit,
                    'system_status' => $inventoryUnit->status,
                    'observed_status' => $row['observed_status'],
                    'is_discrepancy' => $inventoryUnit->status !== $row['observed_status'],
                    'notes' => $row['notes'] ?? null,
                ];
            });

            $session = StockOpnameSession::query()->create([
                'opname_no' => $this->generateOpnameNumber(StockOpnameDomains::RENTAL),
                'domain' => StockOpnameDomains::RENTAL,
                'performed_at' => $performedAt,
                'created_by' => $actor->id,
                'total_items' => $rows->count(),
                'discrepancy_count' => $rows->where('is_discrepancy', true)->count(),
                'notes' => $validated['notes'] ?? null,
            ]);

            $session->rentalItems()->createMany(
                $rows->map(fn (array $row) => [
                    'inventory_unit_id' => $row['inventory_unit']->id,
                    'unit_code_snapshot' => $row['inventory_unit']->unit_code,
                    'product_name_snapshot' => $row['inventory_unit']->product?->name,
                    'system_status' => $row['system_status'],
                    'observed_status' => $row['observed_status'],
                    'is_discrepancy' => $row['is_discrepancy'],
                    'notes' => $row['notes'],
                ])->all(),
            );

            $rows
                ->filter(fn (array $row) => $row['is_discrepancy'])
                ->each(function (array $row): void {
                    /** @var InventoryUnit $inventoryUnit */
                    $inventoryUnit = $row['inventory_unit'];

                    $inventoryUnit->update([
                        'status' => $row['observed_status'],
                    ]);
                });

            return $session->load(['creator', 'rentalItems']);
        });
    }

    private function generateOpnameNumber(string $domain): string
    {
        $datePrefix = now()->format('Ymd');
        $domainPrefix = $domain === StockOpnameDomains::SALES ? 'SALE' : 'RENT';
        $basePrefix = 'ROC-OPN-'.$domainPrefix.'-'.$datePrefix;
        $count = StockOpnameSession::query()
            ->where('opname_no', 'like', $basePrefix.'-%')
            ->count() + 1;

        return sprintf('%s-%04d', $basePrefix, $count);
    }
}
