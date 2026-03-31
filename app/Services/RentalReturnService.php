<?php

namespace App\Services;

use App\Models\InventoryUnit;
use App\Models\Payment;
use App\Models\PaymentMethodConfig;
use App\Models\Rental;
use App\Models\RentalReturn;
use App\Models\User;
use App\Support\Rental\CompensationTypes;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentKinds;
use App\Support\Rental\PaymentMethods;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use App\Support\Rental\ReturnConditions;
use App\Support\Rental\SettlementBases;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RentalReturnService
{
    public function process(User $actor, array $validated): RentalReturn
    {
        return DB::transaction(function () use ($actor, $validated): RentalReturn {
            /** @var Rental|null $rental */
            $rental = Rental::query()
                ->with(['items.inventoryUnit', 'customer', 'creator'])
                ->whereKey($validated['rental_id'])
                ->lockForUpdate()
                ->first();

            if ($rental === null) {
                throw ValidationException::withMessages([
                    'rental_id' => 'Transaksi rental tidak ditemukan.',
                ]);
            }

            if (! in_array($rental->rental_status, [
                RentalStatuses::PICKED_UP,
                RentalStatuses::LATE,
            ], true)) {
                throw ValidationException::withMessages([
                    'rental_id' => 'Transaksi ini tidak dalam status aktif untuk diproses pengembaliannya.',
                ]);
            }

            if ($rental->returnRecord()->exists()) {
                throw ValidationException::withMessages([
                    'rental_id' => 'Transaksi ini sudah pernah diproses pengembaliannya.',
                ]);
            }

            $submittedItems = collect($validated['items'])
                ->keyBy(fn (array $item) => (int) $item['rental_item_id']);

            if ($submittedItems->count() !== $rental->items->count()) {
                throw ValidationException::withMessages([
                    'items' => 'Semua item dalam transaksi harus diproses saat pengembalian.',
                ]);
            }

            $inventoryUnits = InventoryUnit::query()
                ->whereIn('id', $rental->items->pluck('inventory_unit_id'))
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $returnedAt = Carbon::parse($validated['returned_at']);
            $settlementBasis = (string) $validated['settlement_basis'];
            $finalTotalDays = $this->calculateFinalTotalDays($rental, $returnedAt, $settlementBasis);
            $finalSubtotal = $this->calculateFinalSubtotal($rental, $finalTotalDays, $settlementBasis);
            $settlementAmount = round(max(0, $finalSubtotal - (float) $rental->paid_amount), 2);
            $paymentMethodConfig = $this->resolvePaymentMethodConfig($validated['payment_method_config_id'] ?? null);

            $returnRecord = RentalReturn::query()->create([
                'rental_id' => $rental->id,
                'checked_by' => $actor->id,
                'returned_at' => $returnedAt,
                'charge_basis' => $settlementBasis,
                'final_total_days' => $finalTotalDays,
                'final_subtotal' => $finalSubtotal,
                'settlement_amount' => $settlementAmount,
                'guarantee_returned' => (bool) ($validated['guarantee_returned'] ?? false),
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($rental->items as $rentalItem) {
                $submittedItem = $submittedItems->get($rentalItem->id);
                $nextStatus = (string) ($submittedItem['next_unit_status'] ?? InventoryUnitStatuses::READY_UNCLEAN);
                $notes = $submittedItem['notes'] ?? null;

                $returnRecord->items()->create([
                    'rental_item_id' => $rentalItem->id,
                    'replacement_unit_id' => null,
                    'return_condition' => $this->deriveReturnCondition($nextStatus),
                    'next_unit_status' => $nextStatus,
                    'compensation_type' => CompensationTypes::NONE,
                    'compensation_amount' => 0,
                    'notes' => $notes,
                ]);

                $inventoryUnit = $inventoryUnits->get($rentalItem->inventory_unit_id);
                if ($inventoryUnit !== null) {
                    $inventoryUnit->update([
                        'status' => $nextStatus,
                    ]);
                }
            }

            if ($settlementAmount > 0) {
                Payment::query()->create([
                    'rental_id' => $rental->id,
                    'received_by' => $actor->id,
                    'payment_method_config_id' => $paymentMethodConfig?->id,
                    'payment_kind' => PaymentKinds::SETTLEMENT,
                    'amount' => $settlementAmount,
                    'paid_at' => $returnedAt,
                    'method' => $paymentMethodConfig?->type,
                    'method_label_snapshot' => $paymentMethodConfig?->name,
                    'method_type_snapshot' => $paymentMethodConfig?->type,
                    'instructions_snapshot' => $paymentMethodConfig?->instructions,
                    'notes' => $validated['payment_notes'] ?? null,
                ]);
            }

            $rental->update([
                'final_total_days' => $finalTotalDays,
                'final_subtotal' => $finalSubtotal,
                'settlement_basis' => $settlementBasis,
                'paid_amount' => round((float) $rental->paid_amount + $settlementAmount, 2),
                'remaining_amount' => 0,
                'payment_status' => RentalPaymentStatuses::PAID,
                'rental_status' => RentalStatuses::RETURNED,
            ]);

            return $returnRecord->load([
                'rental.customer',
                'checker',
                'items.rentalItem.inventoryUnit.product',
            ]);
        });
    }

    private function resolvePaymentMethodConfig(?int $paymentMethodConfigId): ?PaymentMethodConfig
    {
        if ($paymentMethodConfigId === null) {
            return null;
        }

        return PaymentMethodConfig::query()->find($paymentMethodConfigId);
    }

    private function calculateFinalTotalDays(Rental $rental, Carbon $returnedAt, string $settlementBasis): int
    {
        if ($settlementBasis === SettlementBases::ACTUAL && $rental->starts_at !== null) {
            return max(1, (int) ceil($rental->starts_at->diffInMinutes($returnedAt) / 1440));
        }

        return $rental->total_days;
    }

    private function calculateFinalSubtotal(Rental $rental, int $finalTotalDays, string $settlementBasis): float
    {
        if ($settlementBasis === SettlementBases::ACTUAL) {
            return round(
                $rental->items->sum(fn ($item) => ((float) $item->daily_rate_snapshot) * $finalTotalDays),
                2,
            );
        }

        return round((float) $rental->subtotal, 2);
    }

    private function deriveReturnCondition(string $nextStatus): string
    {
        return in_array($nextStatus, [
            InventoryUnitStatuses::MAINTENANCE,
            InventoryUnitStatuses::RETIRED,
        ], true)
            ? ReturnConditions::DAMAGED
            : ReturnConditions::GOOD;
    }
}
