<?php

namespace App\Services;

use App\Models\User;
use App\Support\Access\RoleNames;

class AdminAccessService
{
    public function canAccessBackOffice(User $user): bool
    {
        return $user->hasAnyRole([
            RoleNames::SUPER_ADMIN,
            RoleNames::ADMIN_TOKO,
        ]);
    }
}
