<?php

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\User;
use App\Support\Access\RoleNames;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MasterDataManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_master_data_pages(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.products.index'))->assertForbidden();
        $this->actingAs($staff)->get(route('admin.inventory-units.index'))->assertForbidden();
        $this->actingAs($staff)->get(route('admin.customers.index'))->assertForbidden();
        $this->actingAs($staff)->get(route('admin.season-rules.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_master_data_pages(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.products.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/products/index'));

        $this->actingAs($admin)
            ->get(route('admin.inventory-units.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/inventory-units/index'));

        $this->actingAs($admin)
            ->get(route('admin.customers.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/customers/index'));

        $this->actingAs($admin)
            ->get(route('admin.season-rules.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/season-rules/index'));
    }

    public function test_admin_toko_can_create_product_inventory_customer_and_season_rule(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)->post(route('admin.products.store'), [
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'daily_rate' => 75000,
            'active' => true,
            'notes' => 'Produk awal untuk rental.',
        ])->assertRedirect(route('admin.products.index'));

        $product = Product::query()->firstOrFail();

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'active' => true,
        ]);

        $this->actingAs($admin)->post(route('admin.inventory-units.store'), [
            'product_id' => $product->id,
            'unit_code' => 'CAR-001',
            'status' => 'ready_clean',
            'notes' => 'Unit awal siap sewa.',
        ])->assertRedirect(route('admin.inventory-units.index'));

        $this->assertDatabaseHas('inventory_units', [
            'product_id' => $product->id,
            'unit_code' => 'CAR-001',
            'status' => 'ready_clean',
        ]);

        $this->actingAs($admin)->post(route('admin.customers.store'), [
            'name' => 'Customer Satu',
            'phone_whatsapp' => '081234567890',
            'address' => 'Bandung',
            'notes' => 'Sering sewa carrier.',
        ])->assertRedirect(route('admin.customers.index'));

        $this->assertDatabaseHas('customers', [
            'name' => 'Customer Satu',
            'phone_whatsapp' => '081234567890',
        ]);

        $this->actingAs($admin)->post(route('admin.season-rules.store'), [
            'name' => 'High Season Lebaran',
            'start_date' => '2026-04-01',
            'end_date' => '2026-04-15',
            'dp_required' => true,
            'dp_type' => 'percentage',
            'dp_value' => 50,
            'active' => true,
            'notes' => 'DP wajib saat stok padat.',
        ])->assertRedirect(route('admin.season-rules.index'));

        $this->assertDatabaseHas('season_rules', [
            'name' => 'High Season Lebaran',
            'dp_required' => true,
            'dp_type' => 'percentage',
            'active' => true,
        ]);
    }

    public function test_season_rule_without_dp_clears_dp_fields(): void
    {
        $admin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);

        $this->actingAs($admin)->post(route('admin.season-rules.store'), [
            'name' => 'Regular Season',
            'start_date' => '2026-05-01',
            'end_date' => '2026-05-31',
            'dp_required' => false,
            'dp_type' => 'fixed_amount',
            'dp_value' => 100000,
            'active' => true,
            'notes' => null,
        ])->assertRedirect(route('admin.season-rules.index'));

        $this->assertDatabaseHas('season_rules', [
            'name' => 'Regular Season',
            'dp_required' => false,
            'dp_type' => null,
            'dp_value' => null,
        ]);
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
