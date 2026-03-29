<?php

namespace App\Services;

use App\Models\PaymentMethodConfig;
use App\Models\Sale;
use App\Models\SaleProduct;
use App\Models\User;
use App\Support\Sales\StockMovementTypes;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleCreationService
{
    public function __construct(
        private readonly SaleStockMovementService $saleStockMovementService,
    ) {
    }

    public function create(User $actor, array $validated): Sale
    {
        return DB::transaction(function () use ($actor, $validated): Sale {
            $soldAt = Carbon::parse($validated['sold_at']);
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

            $paymentMethodConfig = PaymentMethodConfig::query()->findOrFail($validated['payment_method_config_id']);
            $subtotal = 0.0;
            $lineItems = [];

            foreach ($validated['items'] as $line) {
                /** @var SaleProduct $product */
                $product = $products->get((int) $line['sale_product_id']);
                $qty = (int) $line['qty'];

                if (! $product->active) {
                    throw ValidationException::withMessages([
                        'items' => sprintf('Produk "%s" sedang nonaktif dan tidak bisa dijual.', $product->name),
                    ]);
                }

                if ($qty > (int) $product->stock_qty) {
                    throw ValidationException::withMessages([
                        'items' => sprintf('Stok "%s" tidak cukup. Tersedia %d.', $product->name, $product->stock_qty),
                    ]);
                }

                $lineTotal = round(((float) $product->selling_price) * $qty, 2);
                $subtotal += $lineTotal;

                $lineItems[] = [
                    'sale_product_id' => $product->id,
                    'product_name_snapshot' => $product->name,
                    'sku_snapshot' => $product->sku,
                    'selling_price_snapshot' => (float) $product->selling_price,
                    'qty' => $qty,
                    'line_total' => $lineTotal,
                ];
            }

            $subtotal = round($subtotal, 2);
            $discountAmount = round((float) ($validated['discount_amount'] ?? 0), 2);

            if ($discountAmount > $subtotal) {
                throw ValidationException::withMessages([
                    'discount_amount' => 'Diskon tidak boleh melebihi subtotal penjualan.',
                ]);
            }

            $totalAmount = round($subtotal - $discountAmount, 2);

            $sale = Sale::query()->create([
                'sale_no' => $this->generateSaleNumber(),
                'sold_at' => $soldAt,
                'sold_by' => $actor->id,
                'customer_name' => $validated['customer_name'] ?? null,
                'customer_phone' => $validated['customer_phone'] ?? null,
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'total_amount' => $totalAmount,
                'payment_method_config_id' => $paymentMethodConfig->id,
                'payment_method_name_snapshot' => $paymentMethodConfig->name,
                'payment_method_type_snapshot' => $paymentMethodConfig->type,
                'payment_qr_image_path_snapshot' => $paymentMethodConfig->qr_image_path,
                'payment_transfer_bank_snapshot' => $paymentMethodConfig->bank_name,
                'payment_transfer_account_number_snapshot' => $paymentMethodConfig->account_number,
                'payment_transfer_account_name_snapshot' => $paymentMethodConfig->account_name,
                'payment_instruction_snapshot' => $paymentMethodConfig->instructions,
                'notes' => $validated['notes'] ?? null,
            ]);

            $sale->items()->createMany($lineItems);

            foreach ($validated['items'] as $line) {
                /** @var SaleProduct $product */
                $product = $products->get((int) $line['sale_product_id']);
                $qty = (int) $line['qty'];
                $stockBefore = (int) $product->stock_qty;
                $stockAfter = max(0, $stockBefore - $qty);

                $product->update([
                    'stock_qty' => $stockAfter,
                ]);

                $this->saleStockMovementService->record(
                    saleProduct: $product,
                    referenceType: 'sale',
                    referenceId: $sale->id,
                    movementType: StockMovementTypes::OUT,
                    qty: $qty,
                    stockBefore: $stockBefore,
                    stockAfter: $stockAfter,
                    notes: $validated['notes'] ?? null,
                );
            }

            return $sale->load(['items.saleProduct', 'paymentMethodConfig', 'soldBy']);
        });
    }

    private function generateSaleNumber(): string
    {
        $datePrefix = now()->format('Ymd');
        $basePrefix = 'ROC-SALE-'.$datePrefix;
        $count = Sale::query()->where('sale_no', 'like', $basePrefix.'-%')->count() + 1;

        return sprintf('%s-%04d', $basePrefix, $count);
    }
}
