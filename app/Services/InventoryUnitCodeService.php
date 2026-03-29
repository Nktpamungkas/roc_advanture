<?php

namespace App\Services;

use App\Models\InventoryUnit;
use App\Models\Product;

class InventoryUnitCodeService
{
    public function nextSequenceForProduct(Product $product): int
    {
        return $this->nextSequenceFromCodes(
            $product->inventoryUnits()->pluck('unit_code')->all(),
            $product->prefix_code,
        );
    }

    /**
     * @param  array<int, string>  $codes
     */
    public function nextSequenceFromCodes(array $codes, ?string $prefixCode): int
    {
        $prefixCode = trim((string) $prefixCode);

        if ($prefixCode === '') {
            return 1;
        }

        $max = 0;

        foreach ($codes as $code) {
            if (! preg_match('/^'.preg_quote($prefixCode, '/').'-(\d+)$/', $code, $matches)) {
                continue;
            }

            $max = max($max, (int) $matches[1]);
        }

        return $max + 1;
    }

    public function formatCode(string $prefixCode, int $sequence): string
    {
        return sprintf('%s-%03d', $prefixCode, $sequence);
    }

    /**
     * @return array<int, string>
     */
    public function generateCodes(Product $product, int $quantity, ?int $startNumber = null): array
    {
        $prefixCode = trim((string) $product->prefix_code);
        $startNumber ??= $this->nextSequenceForProduct($product);

        return collect(range($startNumber, $startNumber + $quantity - 1))
            ->map(fn (int $sequence) => $this->formatCode($prefixCode, $sequence))
            ->all();
    }

    /**
     * @param  array<int, string>  $codes
     * @return array<int, string>
     */
    public function findExistingCodes(array $codes): array
    {
        return InventoryUnit::query()
            ->whereIn('unit_code', $codes)
            ->orderBy('unit_code')
            ->pluck('unit_code')
            ->all();
    }
}
