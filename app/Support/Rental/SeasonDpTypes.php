<?php

namespace App\Support\Rental;

final class SeasonDpTypes
{
    public const FIXED_AMOUNT = 'fixed_amount';

    public const PERCENTAGE = 'percentage';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::FIXED_AMOUNT,
            self::PERCENTAGE,
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return [
            [
                'value' => self::FIXED_AMOUNT,
                'label' => 'Nominal Tetap',
            ],
            [
                'value' => self::PERCENTAGE,
                'label' => 'Persentase',
            ],
        ];
    }
}
