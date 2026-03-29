<?php

namespace App\Support\Rental;

final class RentalStatuses
{
    public const BOOKED = 'booked';

    public const PICKED_UP = 'picked_up';

    public const RETURNED = 'returned';

    public const LATE = 'late';

    public const CANCELLED = 'cancelled';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::BOOKED,
            self::PICKED_UP,
            self::RETURNED,
            self::LATE,
            self::CANCELLED,
        ];
    }

    public static function label(string $status): string
    {
        return match ($status) {
            self::BOOKED => 'Dibooking',
            self::PICKED_UP => 'Sedang Berjalan',
            self::RETURNED => 'Sudah Kembali',
            self::LATE => 'Terlambat',
            self::CANCELLED => 'Dibatalkan',
            default => $status,
        };
    }
}
