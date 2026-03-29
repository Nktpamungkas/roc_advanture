<?php

namespace App\Support\Access;

final class PermissionNames
{
    public const USERS_VIEW = 'users.view';

    public const USERS_CREATE = 'users.create';

    public const USERS_UPDATE = 'users.update';

    public const USERS_ACTIVATE = 'users.activate';

    public const ROLES_ASSIGN = 'roles.assign';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::USERS_VIEW,
            self::USERS_CREATE,
            self::USERS_UPDATE,
            self::USERS_ACTIVATE,
            self::ROLES_ASSIGN,
        ];
    }
}
