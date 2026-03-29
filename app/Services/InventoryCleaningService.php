<?php

namespace App\Services;

use App\Models\InventoryUnit;
use App\Support\Rental\InventoryUnitStatuses;

class InventoryCleaningService
{
    /**
     * @param  array<int, int|string>  $unitIds
     */
    public function markAsClean(array $unitIds): int
    {
        return InventoryUnit::query()
            ->whereIn('id', collect($unitIds)->map(fn ($id) => (int) $id)->unique()->all())
            ->where('status', InventoryUnitStatuses::READY_UNCLEAN)
            ->update([
                'status' => InventoryUnitStatuses::READY_CLEAN,
                'updated_at' => now(),
            ]);
    }
}
