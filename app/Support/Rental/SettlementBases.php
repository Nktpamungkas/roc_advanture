<?php

namespace App\Support\Rental;

final class SettlementBases
{
    public const CONTRACT = 'contract';

    public const ACTUAL = 'actual';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::CONTRACT,
            self::ACTUAL,
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (string $basis) => [
            'value' => $basis,
            'label' => self::label($basis),
        ], self::all());
    }

    public static function label(string $basis): string
    {
        return match ($basis) {
            self::CONTRACT => 'Sesuai Kontrak',
            self::ACTUAL => 'Sesuai Tanggal Aktual Kembali',
            default => $basis,
        };
    }
}
