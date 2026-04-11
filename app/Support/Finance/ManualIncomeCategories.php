<?php

namespace App\Support\Finance;

class ManualIncomeCategories
{
    public const RENTAL_NON_MASTER = 'rental_non_master';
    public const SALE_NON_MASTER = 'sale_non_master';
    public const OTHER_INCOME = 'other_income';

    public static function options(): array
    {
        return [
            self::RENTAL_NON_MASTER => 'Sewa Non-Master',
            self::SALE_NON_MASTER => 'Penjualan Non-Master',
            self::OTHER_INCOME => 'Pemasukan Lainnya',
        ];
    }

    public static function values(): array
    {
        return array_keys(self::options());
    }

    public static function label(?string $value): string
    {
        return self::options()[$value] ?? 'Pemasukan Manual';
    }
}
