<?php

namespace App\Services;

use App\Models\SaleProduct;
use App\Models\StockMovement;

class SaleStockMovementService
{
    public function record(
        SaleProduct $saleProduct,
        string $referenceType,
        int $referenceId,
        string $movementType,
        int $qty,
        int $stockBefore,
        int $stockAfter,
        ?string $notes = null,
    ): StockMovement {
        return StockMovement::query()->create([
            'sale_product_id' => $saleProduct->id,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'movement_type' => $movementType,
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'happened_at' => now(),
            'notes' => $notes,
        ]);
    }
}
