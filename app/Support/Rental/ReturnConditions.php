<?php

namespace App\Support\Rental;

final class ReturnConditions
{
    public const GOOD = 'good';

    public const DAMAGED = 'damaged';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::GOOD,
            self::DAMAGED,
        ];
    }

    public static function label(string $condition): string
    {
        return match ($condition) {
            self::GOOD => 'Kondisi Baik',
            self::DAMAGED => 'Butuh Perhatian',
            default => $condition,
        };
    }
}
