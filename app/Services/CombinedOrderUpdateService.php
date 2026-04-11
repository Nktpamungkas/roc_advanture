<?php

namespace App\Services;

use App\Models\CombinedOrder;
use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\Payment;
use App\Models\PaymentMethodConfig;
use App\Models\Rental;
use App\Models\Sale;
use App\Models\SaleProduct;
use App\Models\SeasonRule;
use App\Models\User;
use App\Models\WaLog;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentKinds;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use App\Support\Rental\SeasonDpTypes;
use App\Support\Sales\StockMovementTypes;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CombinedOrderUpdateService
{
    public function __construct(
        private readonly SaleStockMovementService $saleStockMovementService,
    ) {
    }

    public function update(User $actor, CombinedOrder $combinedOrder, array $validated): CombinedOrder
    {
        return DB::transaction(function () use ($actor, $combinedOrder, $validated): CombinedOrder {
            /** @var CombinedOrder|null $lockedCombinedOrder */
            $lockedCombinedOrder = CombinedOrder::query()
                ->with([
                    'rentals.customer',
                    'rentals.items.inventoryUnit.product',
                    'rentals.payments',
                    'rentals.returnRecord',
                    'rentals.latestExtension',
                    'sales.items.saleProduct',
                ])
                ->whereKey($combinedOrder->id)
                ->lockForUpdate()
                ->first();

            if ($lockedCombinedOrder === null) {
                throw ValidationException::withMessages([
                    'starts_at' => 'Transaksi gabungan tidak ditemukan.',
                ]);
            }

            $rental = $lockedCombinedOrder->rentals->first();
            $sale = $lockedCombinedOrder->sales->first();

            if ($rental === null || $sale === null) {
                throw ValidationException::withMessages([
                    'starts_at' => 'Transaksi gabungan tidak lengkap dan tidak bisa diedit.',
                ]);
            }

            $this->guardEditable($rental);

            $startsAt = Carbon::parse($validated['starts_at']);
            $dueAt = $this->resolveDueAt($startsAt, $validated);
            $customer = $this->resolveCustomer($validated);
            $paymentMethodConfig = PaymentMethodConfig::query()->findOrFail($validated['payment_method_config_id']);

            $currentRentalItems = $rental->items->keyBy('inventory_unit_id');
            $currentUnitIds = $currentRentalItems->keys()->map(fn ($id) => (int) $id)->all();

            $inventoryUnits = InventoryUnit::query()
                ->with('product:id,name,daily_rate,active')
                ->whereIn('id', $validated['inventory_unit_ids'])
                ->lockForUpdate()
                ->get()
                ->sortBy(fn (InventoryUnit $inventoryUnit) => sprintf('%s-%s', $inventoryUnit->product?->name ?? '', $inventoryUnit->unit_code))
                ->values();

            if ($inventoryUnits->count() !== count($validated['inventory_unit_ids'])) {
                throw ValidationException::withMessages([
                    'inventory_unit_ids' => 'Beberapa unit inventaris yang dipilih tidak ditemukan lagi. Silakan refresh halaman.',
                ]);
            }

            $this->guardInventoryUnits($inventoryUnits, $currentUnitIds);

            $requestedProductIds = collect($validated['sale_items'])
                ->pluck('sale_product_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();

            $saleProducts = SaleProduct::query()
                ->whereIn('id', $requestedProductIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($saleProducts->count() !== $requestedProductIds->count()) {
                throw ValidationException::withMessages([
                    'sale_items' => 'Beberapa produk jual tidak ditemukan lagi. Silakan refresh halaman.',
                ]);
            }

            $currentSaleQuantities = $sale->items
                ->groupBy('sale_product_id')
                ->map(fn (Collection $items) => (int) $items->sum('qty'));

            $saleLineItems = $this->buildSaleLineItems($validated['sale_items'], $saleProducts, $currentSaleQuantities);

            $totalDays = $this->calculateTotalDays($startsAt, $dueAt);
            $rentalSubtotal = round($this->calculateRentalSubtotal($inventoryUnits, $totalDays), 2);
            $saleSubtotal = round($saleLineItems->sum('line_total'), 2);
            $subtotal = round($rentalSubtotal + $saleSubtotal, 2);
            $paidAmount = round((float) ($validated['paid_amount'] ?? 0), 2);
            $remainingAmount = round(max(0, $subtotal - $paidAmount), 2);
            $allocatedRentalPayment = round(max(0, $paidAmount - $saleSubtotal), 2);

            if ($paidAmount < $saleSubtotal) {
                throw ValidationException::withMessages([
                    'paid_amount' => 'Pembayaran minimal harus menutup total barang jual.',
                ]);
            }

            $seasonRule = $this->resolveSeasonRule($startsAt);
            $requiredDpAmount = round($this->calculateRequiredDp($rentalSubtotal, $seasonRule), 2);

            $this->revertRentalUnits($currentRentalItems);
            $this->revertSaleStock($sale, $sale->items, $validated['notes'] ?? null);

            $lockedCombinedOrder->update([
                'ordered_at' => $startsAt,
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone_whatsapp,
                'payment_method_config_id' => $paymentMethodConfig->id,
                'rental_total' => $rentalSubtotal,
                'sale_total' => $saleSubtotal,
                'subtotal' => $subtotal,
                'discount_amount' => 0,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
                'payment_status' => $this->determineCombinedPaymentStatus($subtotal, $paidAmount),
                'payment_method_name_snapshot' => $paymentMethodConfig->name,
                'payment_method_type_snapshot' => $paymentMethodConfig->type,
                'payment_qr_image_path_snapshot' => $paymentMethodConfig->qr_image_path,
                'payment_transfer_bank_snapshot' => $paymentMethodConfig->bank_name,
                'payment_transfer_account_number_snapshot' => $paymentMethodConfig->account_number,
                'payment_transfer_account_name_snapshot' => $paymentMethodConfig->account_name,
                'payment_instruction_snapshot' => $paymentMethodConfig->instructions,
                'notes' => $validated['notes'] ?? null,
            ]);

            $rental->update([
                'customer_id' => $customer->id,
                'season_rule_id' => $seasonRule?->id,
                'payment_method_config_id' => $paymentMethodConfig->id,
                'payment_method_name_snapshot' => $paymentMethodConfig->name,
                'payment_method_type_snapshot' => $paymentMethodConfig->type,
                'payment_qr_image_path_snapshot' => $paymentMethodConfig->qr_image_path,
                'payment_transfer_bank_snapshot' => $paymentMethodConfig->bank_name,
                'payment_transfer_account_number_snapshot' => $paymentMethodConfig->account_number,
                'payment_transfer_account_name_snapshot' => $paymentMethodConfig->account_name,
                'payment_instruction_snapshot' => $paymentMethodConfig->instructions,
                'starts_at' => $startsAt,
                'due_at' => $dueAt,
                'total_days' => $totalDays,
                'final_total_days' => null,
                'dp_required' => (bool) $seasonRule?->dp_required,
                'subtotal' => $rentalSubtotal,
                'final_subtotal' => null,
                'dp_amount' => $requiredDpAmount,
                'dp_override_reason' => $validated['dp_override_reason'] ?? null,
                'paid_amount' => $allocatedRentalPayment,
                'remaining_amount' => round(max(0, $rentalSubtotal - $allocatedRentalPayment), 2),
                'payment_status' => $this->determineRentalPaymentStatus($rentalSubtotal, $allocatedRentalPayment),
                'settlement_basis' => null,
                'rental_status' => $dueAt->isPast() ? RentalStatuses::LATE : RentalStatuses::PICKED_UP,
                'notes' => $validated['notes'] ?? null,
                'guarantee_note' => $validated['guarantee_note'] ?? null,
            ]);

            $rental->items()->delete();
            $rental->items()->createMany(
                $inventoryUnits->map(fn (InventoryUnit $inventoryUnit) => [
                    'inventory_unit_id' => $inventoryUnit->id,
                    'product_name_snapshot' => $inventoryUnit->product?->name,
                    'daily_rate_snapshot' => $inventoryUnit->product?->daily_rate ?? 0,
                    'days' => $totalDays,
                    'line_total' => round(((float) $inventoryUnit->product?->daily_rate) * $totalDays, 2),
                    'status_at_checkout' => $currentRentalItems->get($inventoryUnit->id)?->status_at_checkout
                        ?? (in_array($inventoryUnit->status, [InventoryUnitStatuses::READY_CLEAN, InventoryUnitStatuses::READY_UNCLEAN], true)
                            ? $inventoryUnit->status
                            : InventoryUnitStatuses::READY_CLEAN),
                    'notes' => $currentRentalItems->get($inventoryUnit->id)?->notes,
                ])->all(),
            );

            InventoryUnit::query()
                ->whereIn('id', $inventoryUnits->pluck('id'))
                ->update(['status' => InventoryUnitStatuses::RENTED]);

            $this->syncRentalPayment(
                actor: $actor,
                rental: $rental,
                paymentMethodConfig: $paymentMethodConfig,
                rentalSubtotal: $rentalSubtotal,
                allocatedRentalPayment: $allocatedRentalPayment,
            );

            $sale->update([
                'sold_at' => $startsAt,
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone_whatsapp,
                'subtotal' => $saleSubtotal,
                'discount_amount' => 0,
                'total_amount' => $saleSubtotal,
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

            $sale->items()->delete();
            $sale->items()->createMany($saleLineItems->map(fn (array $lineItem) => [
                'sale_product_id' => $lineItem['sale_product_id'],
                'product_name_snapshot' => $lineItem['product_name_snapshot'],
                'sku_snapshot' => $lineItem['sku_snapshot'],
                'selling_price_snapshot' => $lineItem['selling_price_snapshot'],
                'qty' => $lineItem['qty'],
                'line_total' => $lineItem['line_total'],
            ])->all());

            $this->applySaleStock($sale, $saleLineItems, $saleProducts, $validated['notes'] ?? null);
            $this->resetScheduledReminders($rental);

            return $lockedCombinedOrder->fresh([
                'creator',
                'paymentMethodConfig',
                'rentals.customer',
                'rentals.returnRecord',
                'rentals.latestExtension',
                'rentals.items.inventoryUnit.product',
                'rentals.payments.receiver',
                'sales.soldBy',
                'sales.items.saleProduct',
            ]);
        });
    }

    private function guardEditable(Rental $rental): void
    {
        if (! in_array($rental->rental_status, [RentalStatuses::BOOKED, RentalStatuses::PICKED_UP, RentalStatuses::LATE], true)) {
            throw ValidationException::withMessages([
                'starts_at' => 'Hanya transaksi gabungan aktif yang bisa diedit.',
            ]);
        }

        if ($rental->returnRecord !== null) {
            throw ValidationException::withMessages([
                'starts_at' => 'Transaksi gabungan yang sudah dikembalikan tidak bisa diedit.',
            ]);
        }

        if ($rental->latestExtension !== null) {
            throw ValidationException::withMessages([
                'starts_at' => 'Transaksi gabungan yang sudah diperpanjang belum bisa diedit.',
            ]);
        }

        if ($rental->payments->count() > 1) {
            throw ValidationException::withMessages([
                'paid_amount' => 'Transaksi gabungan dengan pembayaran lanjutan belum bisa diedit.',
            ]);
        }
    }

    private function resolveCustomer(array $validated): Customer
    {
        if (! empty($validated['customer_id'])) {
            return Customer::query()->findOrFail($validated['customer_id']);
        }

        $customer = Customer::query()->firstOrNew([
            'phone_whatsapp' => (string) $validated['customer_phone_whatsapp'],
        ]);

        $customer->fill([
            'name' => $validated['customer_name'],
            'address' => $validated['customer_address'] ?? $customer->address,
        ]);

        $customer->save();

        return $customer;
    }

    private function resolveDueAt(CarbonInterface $startsAt, array $validated): CarbonInterface
    {
        if (! empty($validated['due_at'])) {
            return Carbon::parse($validated['due_at']);
        }

        return $startsAt->copy()->addDays((int) ($validated['rental_days'] ?? 1));
    }

    private function calculateTotalDays(CarbonInterface $startsAt, CarbonInterface $dueAt): int
    {
        return max(1, (int) ceil($startsAt->diffInMinutes($dueAt) / 1440));
    }

    private function calculateRentalSubtotal(Collection $inventoryUnits, int $totalDays): float
    {
        return (float) $inventoryUnits->sum(
            fn (InventoryUnit $inventoryUnit) => ((float) $inventoryUnit->product?->daily_rate) * $totalDays,
        );
    }

    private function guardInventoryUnits(Collection $inventoryUnits, array $currentUnitIds): void
    {
        $unavailableUnits = $inventoryUnits
            ->filter(function (InventoryUnit $inventoryUnit) use ($currentUnitIds): bool {
                if (in_array($inventoryUnit->id, $currentUnitIds, true)) {
                    return false;
                }

                return ! in_array($inventoryUnit->status, [
                    InventoryUnitStatuses::READY_CLEAN,
                    InventoryUnitStatuses::READY_UNCLEAN,
                ], true);
            })
            ->pluck('unit_code')
            ->all();

        if ($unavailableUnits !== []) {
            throw ValidationException::withMessages([
                'inventory_unit_ids' => 'Unit inventaris berikut sudah tidak tersedia: '.implode(', ', $unavailableUnits).'.',
            ]);
        }

        $inactiveProducts = $inventoryUnits
            ->filter(fn (InventoryUnit $inventoryUnit) => ! in_array($inventoryUnit->id, $currentUnitIds, true) && ! (bool) $inventoryUnit->product?->active)
            ->pluck('product.name')
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($inactiveProducts !== []) {
            throw ValidationException::withMessages([
                'inventory_unit_ids' => 'Produk sewa nonaktif tidak bisa dipakai: '.implode(', ', $inactiveProducts).'.',
            ]);
        }
    }

    private function buildSaleLineItems(array $rawItems, Collection $saleProducts, Collection $currentSaleQuantities): Collection
    {
        $lineItems = collect();

        foreach ($rawItems as $index => $line) {
            /** @var SaleProduct|null $product */
            $product = $saleProducts->get((int) $line['sale_product_id']);
            $qty = (int) $line['qty'];

            if (! $product) {
                throw ValidationException::withMessages([
                    "sale_items.$index.sale_product_id" => 'Produk jual tidak ditemukan.',
                ]);
            }

            if (! $product->active) {
                throw ValidationException::withMessages([
                    "sale_items.$index.sale_product_id" => sprintf('Produk "%s" sedang nonaktif.', $product->name),
                ]);
            }

            $availableStockForEdit = (int) $product->stock_qty + (int) ($currentSaleQuantities->get($product->id) ?? 0);
            if ($qty > $availableStockForEdit) {
                throw ValidationException::withMessages([
                    "sale_items.$index.qty" => sprintf('Stok "%s" tidak cukup. Maksimal %d untuk edit transaksi ini.', $product->name, $availableStockForEdit),
                ]);
            }

            $lineItems->push([
                'sale_product_id' => $product->id,
                'product_name_snapshot' => $product->name,
                'sku_snapshot' => $product->sku,
                'selling_price_snapshot' => (float) $product->selling_price,
                'qty' => $qty,
                'line_total' => round(((float) $product->selling_price) * $qty, 2),
            ]);
        }

        return $lineItems;
    }

    private function resolveSeasonRule(CarbonInterface $startsAt): ?SeasonRule
    {
        return SeasonRule::query()
            ->where('active', true)
            ->whereDate('start_date', '<=', $startsAt->toDateString())
            ->whereDate('end_date', '>=', $startsAt->toDateString())
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->first();
    }

    private function calculateRequiredDp(float $subtotal, ?SeasonRule $seasonRule): float
    {
        if (! $seasonRule?->dp_required) {
            return 0;
        }

        return match ($seasonRule->dp_type) {
            SeasonDpTypes::FIXED_AMOUNT => min($subtotal, (float) $seasonRule->dp_value),
            SeasonDpTypes::PERCENTAGE => min($subtotal, round($subtotal * ((float) $seasonRule->dp_value / 100), 2)),
            default => 0,
        };
    }

    private function determineRentalPaymentStatus(float $subtotal, float $paidAmount): string
    {
        if ($paidAmount >= $subtotal) {
            return RentalPaymentStatuses::PAID;
        }

        if ($paidAmount > 0) {
            return RentalPaymentStatuses::DP_PAID;
        }

        return RentalPaymentStatuses::UNPAID;
    }

    private function determineCombinedPaymentStatus(float $subtotal, float $paidAmount): string
    {
        if ($paidAmount >= $subtotal) {
            return 'paid';
        }

        if ($paidAmount > 0) {
            return 'partial';
        }

        return 'unpaid';
    }

    private function revertRentalUnits(Collection $currentRentalItems): void
    {
        foreach ($currentRentalItems as $inventoryUnitId => $item) {
            InventoryUnit::query()
                ->whereKey($inventoryUnitId)
                ->update(['status' => $item->status_at_checkout]);
        }
    }

    private function syncRentalPayment(
        User $actor,
        Rental $rental,
        PaymentMethodConfig $paymentMethodConfig,
        float $rentalSubtotal,
        float $allocatedRentalPayment,
    ): void {
        /** @var Payment|null $payment */
        $payment = $rental->payments()->latest('id')->first();

        if ($allocatedRentalPayment <= 0) {
            if ($payment !== null) {
                $payment->delete();
            }

            return;
        }

        $payload = [
            'received_by' => $actor->id,
            'payment_method_config_id' => $paymentMethodConfig->id,
            'payment_kind' => $allocatedRentalPayment >= $rentalSubtotal ? PaymentKinds::SETTLEMENT : PaymentKinds::DP,
            'amount' => $allocatedRentalPayment,
            'paid_at' => $payment?->paid_at ?? now(),
            'method' => $paymentMethodConfig->type,
            'method_label_snapshot' => $paymentMethodConfig->name,
            'method_type_snapshot' => $paymentMethodConfig->type,
            'instructions_snapshot' => $paymentMethodConfig->instructions,
            'notes' => 'Dialokasikan dari transaksi gabungan.',
        ];

        if ($payment !== null) {
            $payment->update($payload);

            return;
        }

        $rental->payments()->create($payload);
    }

    private function revertSaleStock(Sale $sale, Collection $currentSaleItems, ?string $notes): void
    {
        foreach ($currentSaleItems as $saleItem) {
            if ($saleItem->sale_product_id === null || $saleItem->saleProduct === null) {
                continue;
            }

            $product = SaleProduct::query()->lockForUpdate()->find($saleItem->sale_product_id);
            if (! $product) {
                continue;
            }

            $stockBefore = (int) $product->stock_qty;
            $stockAfter = $stockBefore + (int) $saleItem->qty;

            $product->update([
                'stock_qty' => $stockAfter,
            ]);

            $this->saleStockMovementService->record(
                saleProduct: $product,
                referenceType: 'combined_sale_edit_revert',
                referenceId: $sale->id,
                movementType: StockMovementTypes::ADJUSTMENT,
                qty: (int) $saleItem->qty,
                stockBefore: $stockBefore,
                stockAfter: $stockAfter,
                notes: $notes ?: 'Penyesuaian stok karena edit transaksi gabungan.',
            );
        }
    }

    private function applySaleStock(Sale $sale, Collection $saleLineItems, Collection $saleProducts, ?string $notes): void
    {
        foreach ($saleLineItems as $lineItem) {
            /** @var SaleProduct|null $product */
            $product = SaleProduct::query()->lockForUpdate()->find($lineItem['sale_product_id']);
            if ($product === null) {
                continue;
            }
            $stockBefore = (int) $product->stock_qty;
            $stockAfter = max(0, $stockBefore - (int) $lineItem['qty']);

            $product->update([
                'stock_qty' => $stockAfter,
            ]);

            $this->saleStockMovementService->record(
                saleProduct: $product,
                referenceType: 'combined_sale_edit_apply',
                referenceId: $sale->id,
                movementType: StockMovementTypes::OUT,
                qty: (int) $lineItem['qty'],
                stockBefore: $stockBefore,
                stockAfter: $stockAfter,
                notes: $notes ?: 'Pemakaian stok terbaru dari edit transaksi gabungan.',
            );
        }
    }

    private function resetScheduledReminders(Rental $rental): void
    {
        WaLog::query()
            ->where('rental_id', $rental->id)
            ->whereIn('message_type', ['rental_due_reminder', 'rental_overdue_reminder'])
            ->where('status', 'pending')
            ->delete();
    }
}
