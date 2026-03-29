<?php

namespace Database\Seeders;

use App\Services\RolePermissionBootstrapper;
use Illuminate\Database\Seeder;

class RoleAndPermissionSeeder extends Seeder
{
    public function run(RolePermissionBootstrapper $rolePermissionBootstrapper): void
    {
        $rolePermissionBootstrapper->ensureRolesAndPermissions();
    }
}
