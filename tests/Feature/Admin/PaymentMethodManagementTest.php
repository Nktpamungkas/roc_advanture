<?php

namespace Tests\Feature\Admin;

use App\Models\PaymentMethodConfig;
use App\Models\User;
use App\Support\Access\RoleNames;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PaymentMethodManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_admin_toko_cannot_access_payment_method_management(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)->get(route('admin.payment-methods.index'))->assertForbidden();
    }

    public function test_super_admin_can_open_payment_method_management(): void
    {
        $superAdmin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);

        $this->actingAs($superAdmin)
            ->get(route('admin.payment-methods.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/payment-methods/index'));
    }

    public function test_super_admin_can_create_payment_method(): void
    {
        $superAdmin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);

        $this->actingAs($superAdmin)->post(route('admin.payment-methods.store'), [
            'name' => 'Transfer BCA',
            'type' => 'transfer',
            'code' => 'transfer-bca',
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'Roc Advanture',
            'instructions' => 'Silakan transfer lalu kirim bukti.',
            'active' => true,
            'sort_order' => 1,
        ])->assertRedirect(route('admin.payment-methods.index'));

        $this->assertDatabaseHas('payment_method_configs', [
            'name' => 'Transfer BCA',
            'type' => 'transfer',
            'code' => 'transfer-bca',
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'active' => true,
        ]);
    }

    public function test_admin_toko_can_fetch_active_payment_method_options_for_operational_forms(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        PaymentMethodConfig::query()->create([
            'name' => 'QRIS Toko',
            'type' => 'qris',
            'code' => 'qris-toko',
            'active' => true,
        ]);

        PaymentMethodConfig::query()->create([
            'name' => 'Transfer Lama',
            'type' => 'transfer',
            'code' => 'transfer-lama',
            'active' => false,
        ]);

        $this->actingAs($admin)
            ->getJson(route('admin.payment-methods.options'))
            ->assertOk()
            ->assertJsonCount(1, 'payment_method_options')
            ->assertJsonPath('payment_method_options.0.label', 'QRIS Toko');
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
