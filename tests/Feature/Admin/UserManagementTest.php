<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Support\Access\RoleNames;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_user_management(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)
            ->get(route('admin.users.index'))
            ->assertForbidden();
    }

    public function test_admin_toko_only_sees_staff_users_in_user_management(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO, ['email' => 'admin-toko@example.com']);
        $staff = $this->createUserWithRole(RoleNames::STAFF, ['email' => 'staff@example.com']);
        $this->createUserWithRole(RoleNames::SUPER_ADMIN, ['email' => 'super-admin@example.com']);
        $this->createUserWithRole(RoleNames::ADMIN_TOKO, ['email' => 'other-admin@example.com']);

        $response = $this->actingAs($admin)->get(route('admin.users.index'));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/users/index')
            ->has('users', 1)
            ->where('users.0.email', $staff->email));
    }

    public function test_admin_toko_can_create_staff_users(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $response = $this->actingAs($admin)->post(route('admin.users.store'), [
            'name' => 'Staff Baru',
            'email' => 'staff-baru@example.com',
            'role' => RoleNames::STAFF,
            'is_active' => true,
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertRedirect(route('admin.users.index'));
        $this->assertDatabaseHas('users', [
            'email' => 'staff-baru@example.com',
            'is_active' => true,
        ]);
        $this->assertTrue(User::query()->where('email', 'staff-baru@example.com')->firstOrFail()->hasRole(RoleNames::STAFF));
    }

    public function test_admin_toko_cannot_create_admin_users(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $response = $this->actingAs($admin)->from(route('admin.users.index'))->post(route('admin.users.store'), [
            'name' => 'Admin Baru',
            'email' => 'admin-baru@example.com',
            'role' => RoleNames::ADMIN_TOKO,
            'is_active' => true,
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertRedirect(route('admin.users.index'));
        $response->assertSessionHasErrors('role');
    }

    public function test_admin_toko_cannot_update_non_staff_users(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $superAdmin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);

        $this->actingAs($admin)
            ->patch(route('admin.users.update', $superAdmin), [
                'name' => $superAdmin->name,
                'email' => $superAdmin->email,
                'role' => RoleNames::SUPER_ADMIN,
                'is_active' => true,
            ])
            ->assertForbidden();
    }

    public function test_super_admin_can_update_any_user(): void
    {
        $superAdmin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);
        $staff = $this->createUserWithRole(RoleNames::STAFF, [
            'name' => 'Staff Lama',
            'email' => 'staff-lama@example.com',
        ]);

        $response = $this->actingAs($superAdmin)->patch(route('admin.users.update', $staff), [
            'name' => 'Staff Baru',
            'email' => 'staff-baru@example.com',
            'role' => RoleNames::ADMIN_TOKO,
            'is_active' => false,
        ]);

        $response->assertRedirect(route('admin.users.index'));
        $this->assertDatabaseHas('users', [
            'id' => $staff->id,
            'name' => 'Staff Baru',
            'email' => 'staff-baru@example.com',
            'is_active' => false,
        ]);
        $this->assertTrue($staff->fresh()->hasRole(RoleNames::ADMIN_TOKO));
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
