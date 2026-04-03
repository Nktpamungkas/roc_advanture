<?php

namespace App\Services;

use App\Models\InventoryUnit;
use App\Models\Rental;
use App\Models\User;
use App\Models\WaLog;
use App\Support\Rental\RentalStatuses;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RentalCancellationService
{
    public function cancel(User $actor, Rental $rental, array $validated): Rental
    {
        return DB::transaction(function () use ($actor, $rental, $validated): Rental {
            /** @var Rental|null $lockedRental */
            $lockedRental = Rental::query()
                ->with(['items.inventoryUnit', 'customer', 'creator', 'payments.receiver'])
                ->whereKey($rental->id)
                ->lockForUpdate()
                ->first();

            if ($lockedRental === null) {
                throw ValidationException::withMessages([
                    'cancel_reason' => 'Transaksi rental tidak ditemukan.',
                ]);
            }

            if (! in_array($lockedRental->rental_status, [RentalStatuses::BOOKED, RentalStatuses::PICKED_UP, RentalStatuses::LATE], true)) {
                throw ValidationException::withMessages([
                    'cancel_reason' => 'Hanya rental aktif yang bisa dibatalkan.',
                ]);
            }

            foreach ($lockedRental->items as $item) {
                if ($item->inventory_unit_id !== null) {
                    InventoryUnit::query()
                        ->whereKey($item->inventory_unit_id)
                        ->update(['status' => $item->status_at_checkout]);
                }
            }

            $lockedRental->update([
                'rental_status' => RentalStatuses::CANCELLED,
                'cancel_reason' => $validated['cancel_reason'],
            ]);

            WaLog::query()
                ->where('rental_id', $lockedRental->id)
                ->whereIn('message_type', ['rental_due_reminder', 'rental_overdue_reminder'])
                ->where('status', 'pending')
                ->delete();

            return $lockedRental->fresh([
                'customer',
                'creator',
                'items.inventoryUnit.product',
                'payments.receiver',
            ]);
        });
    }
}
