<?php

namespace App\Services;

use App\Support\Access\PermissionNames;
use App\Support\Access\RoleNames;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionBootstrapper
{
    public function __construct(
        private readonly PermissionRegistrar $permissionRegistrar,
    ) {
    }

    public function ensureRolesAndPermissions(): void
    {
        $this->permissionRegistrar->forgetCachedPermissions();

        foreach (PermissionNames::all() as $permissionName) {
            Permission::findOrCreate($permissionName, 'web');
        }

        $roles = [
            RoleNames::SUPER_ADMIN => PermissionNames::all(),
            RoleNames::ADMIN_TOKO => [
                PermissionNames::USERS_VIEW,
                PermissionNames::USERS_CREATE,
                PermissionNames::USERS_UPDATE,
                PermissionNames::USERS_ACTIVATE,
                PermissionNames::ROLES_ASSIGN,
            ],
            RoleNames::STAFF => [],
        ];

        foreach ($roles as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName, 'web');
            $role->syncPermissions($permissions);
        }

        $this->permissionRegistrar->forgetCachedPermissions();
    }
}
