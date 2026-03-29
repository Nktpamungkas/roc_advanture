<?php

namespace App\Services;

use App\Models\InventoryUnit;
use App\Models\Rental;
use App\Models\RentalReturn;
use App\Models\User;
use App\Support\Rental\CompensationTypes;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\RentalStatuses;
use App\Support\Rental\ReturnConditions;
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
                ->with(['items.inventoryUnit'])
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

            $returnRecord = RentalReturn::query()->create([
                'rental_id' => $rental->id,
                'checked_by' => $actor->id,
                'returned_at' => Carbon::parse($validated['returned_at']),
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

            $rental->update([
                'rental_status' => RentalStatuses::RETURNED,
            ]);

            return $returnRecord->load([
                'rental.customer',
                'checker',
                'items.rentalItem.inventoryUnit.product',
            ]);
        });
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
