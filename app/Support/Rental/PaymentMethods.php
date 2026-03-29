<?php

namespace App\Support\Rental;

final class PaymentMethods
{
    public const CASH = 'cash';

    public const TRANSFER = 'transfer';

    public const QRIS = 'qris';

    public const OTHER = 'other';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::CASH,
            self::TRANSFER,
            self::QRIS,
            self::OTHER,
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (string $method) => [
            'value' => $method,
            'label' => self::label($method),
        ], self::all());
    }

    public static function label(?string $method): string
    {
        return match ($method) {
            self::CASH => 'Cash',
            self::TRANSFER => 'Transfer',
            self::QRIS => 'QRIS',
            self::OTHER => 'Lainnya',
            null => '-',
            default => $method,
        };
    }
}
