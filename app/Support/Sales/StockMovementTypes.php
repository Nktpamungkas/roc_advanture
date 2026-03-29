<?php

namespace App\Support\Sales;

final class StockMovementTypes
{
    public const IN = 'in';

    public const OUT = 'out';

    public const ADJUSTMENT = 'adjustment';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::IN,
            self::OUT,
            self::ADJUSTMENT,
        ];
    }

    public static function label(string $type): string
    {
        return match ($type) {
            self::IN => 'Stok Masuk',
            self::OUT => 'Stok Keluar',
            self::ADJUSTMENT => 'Penyesuaian',
            default => $type,
        };
    }
}
