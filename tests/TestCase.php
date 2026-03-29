<?php

namespace Tests;

use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function seedRolesAndPermissions(): void
    {
        $this->seed(RoleAndPermissionSeeder::class);
    }
}
