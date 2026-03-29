<?php

namespace App\Support\Rental;

final class InventoryUnitStatuses
{
    public const READY_CLEAN = 'ready_clean';

    public const READY_UNCLEAN = 'ready_unclean';

    public const RENTED = 'rented';

    public const MAINTENANCE = 'maintenance';

    public const RETIRED = 'retired';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::READY_CLEAN,
            self::READY_UNCLEAN,
            self::RENTED,
            self::MAINTENANCE,
            self::RETIRED,
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (string $status) => [
            'value' => $status,
            'label' => self::label($status),
        ], self::all());
    }

    public static function label(string $status): string
    {
        return match ($status) {
            self::READY_CLEAN => 'Ready Bersih',
            self::READY_UNCLEAN => 'Ready Belum Dicuci',
            self::RENTED => 'Sedang Disewa',
            self::MAINTENANCE => 'Maintenance',
            self::RETIRED => 'Retired',
            default => $status,
        };
    }
}
