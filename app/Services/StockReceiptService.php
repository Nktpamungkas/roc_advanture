<?php

namespace App\Services;

use App\Models\SaleProduct;
use App\Models\StockReceipt;
use App\Models\User;
use App\Support\Sales\StockMovementTypes;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockReceiptService
{
    public function __construct(
        private readonly SaleStockMovementService $saleStockMovementService,
    ) {
    }

    public function create(User $actor, array $validated): StockReceipt
    {
        return DB::transaction(function () use ($actor, $validated): StockReceipt {
            $receivedAt = Carbon::parse($validated['received_at']);
            $productIds = collect($validated['items'])->pluck('sale_product_id')->map(fn ($id) => (int) $id)->unique()->values();

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

            $receipt = StockReceipt::query()->create([
                'receipt_no' => $this->generateReceiptNumber(),
                'supplier_name' => $validated['supplier_name'] ?? null,
                'received_at' => $receivedAt,
                'received_by' => $actor->id,
                'notes' => $validated['notes'] ?? null,
            ]);

            $lineItems = [];

            foreach ($validated['items'] as $line) {
                /** @var SaleProduct $product */
                $product = $products->get((int) $line['sale_product_id']);
                $qty = (int) $line['qty'];
                $purchasePrice = round((float) $line['purchase_price'], 2);
                $stockBefore = (int) $product->stock_qty;
                $stockAfter = $stockBefore + $qty;

                $lineItems[] = [
                    'sale_product_id' => $product->id,
                    'product_name_snapshot' => $product->name,
                    'sku_snapshot' => $product->sku,
                    'purchase_price' => $purchasePrice,
                    'qty' => $qty,
                    'line_total' => round($purchasePrice * $qty, 2),
                ];

                $product->update([
                    'purchase_price' => $purchasePrice,
                    'stock_qty' => $stockAfter,
                ]);

                $this->saleStockMovementService->record(
                    saleProduct: $product,
                    referenceType: 'stock_receipt',
                    referenceId: $receipt->id,
                    movementType: StockMovementTypes::IN,
                    qty: $qty,
                    stockBefore: $stockBefore,
                    stockAfter: $stockAfter,
                    notes: $validated['notes'] ?? null,
                );
            }

            $receipt->items()->createMany($lineItems);

            return $receipt->load(['receiver', 'items.saleProduct']);
        });
    }

    private function generateReceiptNumber(): string
    {
        $datePrefix = now()->format('Ymd');
        $basePrefix = 'ROC-IN-'.$datePrefix;
        $count = StockReceipt::query()->where('receipt_no', 'like', $basePrefix.'-%')->count() + 1;

        return sprintf('%s-%04d', $basePrefix, $count);
    }
}
