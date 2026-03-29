<?php

namespace App\Support\Access;

final class RoleNames
{
    public const SUPER_ADMIN = 'super-admin';

    public const ADMIN_TOKO = 'admin-toko';

    public const STAFF = 'staff';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::SUPER_ADMIN,
            self::ADMIN_TOKO,
            self::STAFF,
        ];
    }
}
