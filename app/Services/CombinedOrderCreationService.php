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

class CombinedOrderCreationService
{
    public function __construct(
        private readonly SaleStockMovementService $saleStockMovementService,
    ) {
    }

    public function create(User $actor, array $validated): CombinedOrder
    {
        return DB::transaction(function () use ($actor, $validated): CombinedOrder {
            $startsAt = Carbon::parse($validated['starts_at']);
            $dueAt = $this->resolveDueAt($startsAt, $validated);
            $customer = $this->resolveCustomer($validated);
            $paymentMethodConfig = PaymentMethodConfig::query()->findOrFail($validated['payment_method_config_id']);

            $inventoryUnits = InventoryUnit::query()
                ->with('product:id,name,daily_rate,active')
                ->whereIn('id', $validated['inventory_unit_ids'])
                ->lockForUpdate()
                ->get()
                ->sortBy(fn (InventoryUnit $inventoryUnit) => sprintf('%s-%s', $inventoryUnit->product?->name ?? '', $inventoryUnit->unit_code))
                ->values();

            $requestedUnitCount = count($validated['inventory_unit_ids']);
            if ($inventoryUnits->count() !== $requestedUnitCount) {
                throw ValidationException::withMessages([
                    'inventory_unit_ids' => 'Beberapa unit inventaris yang dipilih tidak ditemukan lagi. Silakan refresh halaman.',
                ]);
            }

            $productIds = collect($validated['sale_items'])->pluck('sale_product_id')->map(fn ($id) => (int) $id)->unique()->values();
            $saleProducts = SaleProduct::query()
                ->whereIn('id', $productIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($saleProducts->count() !== $productIds->count()) {
                throw ValidationException::withMessages([
                    'sale_items' => 'Beberapa produk jual tidak ditemukan lagi. Silakan refresh halaman.',
                ]);
            }

            $this->guardInventoryUnits($inventoryUnits);
            $saleLineItems = $this->buildSaleLineItems($validated['sale_items'], $saleProducts);

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

            $combinedOrder = CombinedOrder::query()->create([
                'combined_no' => $this->generateCombinedNumber($startsAt),
                'ordered_at' => $startsAt,
                'created_by' => $actor->id,
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

            $rental = Rental::query()->create([
                'rental_no' => $this->generateRentalNumber($startsAt),
                'customer_id' => $customer->id,
                'season_rule_id' => $seasonRule?->id,
                'combined_order_id' => $combinedOrder->id,
                'payment_method_config_id' => $paymentMethodConfig->id,
                'payment_method_name_snapshot' => $paymentMethodConfig->name,
                'payment_method_type_snapshot' => $paymentMethodConfig->type,
                'payment_qr_image_path_snapshot' => $paymentMethodConfig->qr_image_path,
                'payment_transfer_bank_snapshot' => $paymentMethodConfig->bank_name,
                'payment_transfer_account_number_snapshot' => $paymentMethodConfig->account_number,
                'payment_transfer_account_name_snapshot' => $paymentMethodConfig->account_name,
                'payment_instruction_snapshot' => $paymentMethodConfig->instructions,
                'created_by' => $actor->id,
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
                'rental_status' => RentalStatuses::PICKED_UP,
                'notes' => $validated['notes'] ?? null,
                'guarantee_note' => $validated['guarantee_note'] ?? null,
            ]);

            $rental->items()->createMany(
                $inventoryUnits->map(fn (InventoryUnit $inventoryUnit) => [
                    'inventory_unit_id' => $inventoryUnit->id,
                    'product_name_snapshot' => $inventoryUnit->product?->name,
                    'daily_rate_snapshot' => $inventoryUnit->product?->daily_rate ?? 0,
                    'days' => $totalDays,
                    'line_total' => round(((float) $inventoryUnit->product?->daily_rate) * $totalDays, 2),
                    'status_at_checkout' => $inventoryUnit->status,
                    'notes' => null,
                ])->all(),
            );

            InventoryUnit::query()
                ->whereIn('id', $inventoryUnits->pluck('id'))
                ->update(['status' => InventoryUnitStatuses::RENTED]);

            if ($allocatedRentalPayment > 0) {
                Payment::query()->create([
                    'rental_id' => $rental->id,
                    'received_by' => $actor->id,
                    'payment_method_config_id' => $paymentMethodConfig->id,
                    'payment_kind' => $allocatedRentalPayment >= $rentalSubtotal ? PaymentKinds::SETTLEMENT : PaymentKinds::DP,
                    'amount' => $allocatedRentalPayment,
                    'paid_at' => now(),
                    'method' => $paymentMethodConfig->type,
                    'method_label_snapshot' => $paymentMethodConfig->name,
                    'method_type_snapshot' => $paymentMethodConfig->type,
                    'instructions_snapshot' => $paymentMethodConfig->instructions,
                    'notes' => 'Dialokasikan dari transaksi gabungan.',
                ]);
            }

            $sale = Sale::query()->create([
                'sale_no' => $this->generateSaleNumber($startsAt),
                'sold_at' => $startsAt,
                'sold_by' => $actor->id,
                'combined_order_id' => $combinedOrder->id,
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

            $sale->items()->createMany($saleLineItems->map(fn (array $lineItem) => [
                'sale_product_id' => $lineItem['sale_product_id'],
                'product_name_snapshot' => $lineItem['product_name_snapshot'],
                'sku_snapshot' => $lineItem['sku_snapshot'],
                'selling_price_snapshot' => $lineItem['selling_price_snapshot'],
                'qty' => $lineItem['qty'],
                'line_total' => $lineItem['line_total'],
            ])->all());

            foreach ($saleLineItems as $lineItem) {
                /** @var SaleProduct $product */
                $product = $saleProducts->get($lineItem['sale_product_id']);
                $stockBefore = (int) $product->stock_qty;
                $stockAfter = max(0, $stockBefore - (int) $lineItem['qty']);

                $product->update([
                    'stock_qty' => $stockAfter,
                ]);

                $this->saleStockMovementService->record(
                    saleProduct: $product,
                    referenceType: 'combined_sale',
                    referenceId: $sale->id,
                    movementType: StockMovementTypes::OUT,
                    qty: (int) $lineItem['qty'],
                    stockBefore: $stockBefore,
                    stockAfter: $stockAfter,
                    notes: $validated['notes'] ?? null,
                );
            }

            return $combinedOrder->load([
                'creator',
                'paymentMethodConfig',
                'rentals.customer',
                'rentals.items.inventoryUnit.product',
                'rentals.payments.receiver',
                'sales.soldBy',
                'sales.items.saleProduct',
            ]);
        });
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

    private function guardInventoryUnits(Collection $inventoryUnits): void
    {
        $unavailableUnits = $inventoryUnits
            ->filter(fn (InventoryUnit $inventoryUnit) => ! in_array($inventoryUnit->status, [
                InventoryUnitStatuses::READY_CLEAN,
                InventoryUnitStatuses::READY_UNCLEAN,
            ], true))
            ->pluck('unit_code')
            ->all();

        if ($unavailableUnits !== []) {
            throw ValidationException::withMessages([
                'inventory_unit_ids' => 'Unit inventaris berikut sudah tidak tersedia: '.implode(', ', $unavailableUnits).'.',
            ]);
        }

        $inactiveProducts = $inventoryUnits
            ->filter(fn (InventoryUnit $inventoryUnit) => ! (bool) $inventoryUnit->product?->active)
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

    private function buildSaleLineItems(array $rawItems, Collection $saleProducts): Collection
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

            if ($qty > (int) $product->stock_qty) {
                throw ValidationException::withMessages([
                    "sale_items.$index.qty" => sprintf('Stok "%s" tidak cukup. Tersedia %d.', $product->name, $product->stock_qty),
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

    private function generateCombinedNumber(CarbonInterface $orderedAt): string
    {
        $datePrefix = $orderedAt->format('Ymd');
        $basePrefix = 'ROC-CMB-'.$datePrefix;
        $count = CombinedOrder::query()->where('combined_no', 'like', $basePrefix.'-%')->count() + 1;

        return sprintf('%s-%04d', $basePrefix, $count);
    }

    private function generateRentalNumber(CarbonInterface $startsAt): string
    {
        $datePrefix = $startsAt->format('Ymd');
        $basePrefix = 'ROC-RENT-'.$datePrefix;
        $count = Rental::query()->where('rental_no', 'like', $basePrefix.'-%')->count() + 1;

        return sprintf('%s-%04d', $basePrefix, $count);
    }

    private function generateSaleNumber(CarbonInterface $soldAt): string
    {
        $datePrefix = $soldAt->format('Ymd');
        $basePrefix = 'ROC-SALE-'.$datePrefix;
        $count = Sale::query()->where('sale_no', 'like', $basePrefix.'-%')->count() + 1;

        return sprintf('%s-%04d', $basePrefix, $count);
    }
}
