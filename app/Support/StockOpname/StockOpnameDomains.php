<?php

namespace App\Support\StockOpname;

final class StockOpnameDomains
{
    public const SALES = 'sales';

    public const RENTAL = 'rental';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::SALES,
            self::RENTAL,
        ];
    }

    public static function label(string $domain): string
    {
        return match ($domain) {
            self::SALES => 'Penjualan',
            self::RENTAL => 'Rental',
            default => $domain,
        };
    }
}
