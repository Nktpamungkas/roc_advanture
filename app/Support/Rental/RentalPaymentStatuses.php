<?php

namespace App\Support\Rental;

final class RentalPaymentStatuses
{
    public const UNPAID = 'unpaid';

    public const DP_PAID = 'dp_paid';

    public const PAID = 'paid';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::UNPAID,
            self::DP_PAID,
            self::PAID,
        ];
    }

    public static function label(string $status): string
    {
        return match ($status) {
            self::UNPAID => 'Belum Dibayar',
            self::DP_PAID => 'Dibayar Sebagian',
            self::PAID => 'Lunas',
            default => $status,
        };
    }
}
