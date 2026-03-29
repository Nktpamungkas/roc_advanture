<?php

namespace Tests\Feature\Admin;

use App\Models\Customer;
use App\Models\Product;
use App\Models\SeasonRule;
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
            'prefix_code' => 'CAR50',
            'daily_rate' => 75000,
            'active' => true,
            'notes' => 'Produk awal untuk rental.',
        ])->assertRedirect(route('admin.products.index'));

        $product = Product::query()->firstOrFail();

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'prefix_code' => 'CAR50',
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

    public function test_admin_toko_can_bulk_generate_inventory_units_from_product_prefix(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $product = Product::query()->create([
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'prefix_code' => 'CAR50',
            'daily_rate' => 75000,
            'active' => true,
        ]);

        $this->actingAs($admin)->post(route('admin.inventory-units.generate'), [
            'product_id' => $product->id,
            'quantity' => 3,
            'status' => 'ready_clean',
            'notes' => 'Batch awal',
        ])->assertRedirect(route('admin.inventory-units.index'));

        $this->assertDatabaseHas('inventory_units', [
            'product_id' => $product->id,
            'unit_code' => 'CAR50-001',
        ]);
        $this->assertDatabaseHas('inventory_units', [
            'product_id' => $product->id,
            'unit_code' => 'CAR50-002',
        ]);
        $this->assertDatabaseHas('inventory_units', [
            'product_id' => $product->id,
            'unit_code' => 'CAR50-003',
        ]);
    }

    public function test_bulk_generate_uses_next_available_sequence_when_units_already_exist(): void
    {
        $admin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);
        $product = Product::query()->create([
            'name' => 'Tenda 4P',
            'category' => 'Tenda',
            'prefix_code' => 'TND4P',
            'daily_rate' => 120000,
            'active' => true,
        ]);

        $product->inventoryUnits()->create([
            'unit_code' => 'TND4P-001',
            'status' => 'ready_clean',
        ]);

        $product->inventoryUnits()->create([
            'unit_code' => 'TND4P-002',
            'status' => 'ready_clean',
        ]);

        $this->actingAs($admin)->post(route('admin.inventory-units.generate'), [
            'product_id' => $product->id,
            'quantity' => 2,
            'status' => 'ready_unclean',
        ])->assertRedirect(route('admin.inventory-units.index'));

        $this->assertDatabaseHas('inventory_units', [
            'product_id' => $product->id,
            'unit_code' => 'TND4P-003',
            'status' => 'ready_unclean',
        ]);
        $this->assertDatabaseHas('inventory_units', [
            'product_id' => $product->id,
            'unit_code' => 'TND4P-004',
            'status' => 'ready_unclean',
        ]);
    }

    public function test_inventory_index_can_filter_and_paginate_units(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $carrier = Product::query()->create([
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'prefix_code' => 'CAR50',
            'daily_rate' => 75000,
            'active' => true,
        ]);
        $tent = Product::query()->create([
            'name' => 'Tenda 4P',
            'category' => 'Tenda',
            'prefix_code' => 'TND4P',
            'daily_rate' => 120000,
            'active' => true,
        ]);

        $carrier->inventoryUnits()->createMany(
            collect(range(1, 11))
                ->map(fn (int $number) => [
                    'unit_code' => sprintf('CAR50-%03d', $number),
                    'status' => 'ready_clean',
                ])
                ->all(),
        );
        $tent->inventoryUnits()->create([
            'unit_code' => 'TND4P-001',
            'status' => 'maintenance',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.inventory-units.index', [
                'search' => 'CAR50',
                'product' => $carrier->id,
                'status' => 'ready_clean',
                'per_page' => 10,
                'page' => 2,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/inventory-units/index')
                ->where('inventoryFilters.search', 'CAR50')
                ->where('inventoryFilters.product', (string) $carrier->id)
                ->where('inventoryFilters.status', 'ready_clean')
                ->where('inventoryPagination.per_page', 10)
                ->where('inventoryPagination.current_page', 2)
                ->where('inventoryPagination.total', 11)
                ->has('inventoryUnits', 1)
                ->where('inventoryUnits.0.unit_code', 'CAR50-011'));
    }

    public function test_product_index_can_filter_by_status_and_paginate(): void
    {
        $admin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);

        Product::query()->create([
            'name' => 'Carrier 30L',
            'category' => 'Carrier',
            'prefix_code' => 'CAR30',
            'daily_rate' => 50000,
            'active' => false,
        ]);

        collect(range(1, 11))->each(function (int $number): void {
            Product::query()->create([
                'name' => 'Carrier 50L '.$number,
                'category' => 'Carrier',
                'prefix_code' => sprintf('CAR5%d', $number),
                'daily_rate' => 75000,
                'active' => true,
            ]);
        });

        $this->actingAs($admin)
            ->get(route('admin.products.index', [
                'search' => 'Carrier 50L',
                'status' => 'active',
                'per_page' => 10,
                'page' => 2,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/products/index')
                ->where('productFilters.search', 'Carrier 50L')
                ->where('productFilters.status', 'active')
                ->where('productPagination.per_page', 10)
                ->where('productPagination.current_page', 2)
                ->where('productPagination.total', 11)
                ->has('products', 1)
                ->where('products.0.name', 'Carrier 50L 9'));
    }

    public function test_customer_index_can_search_and_paginate(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        Customer::query()->create([
            'name' => 'Nina Bandung',
            'phone_whatsapp' => '081111111111',
        ]);

        collect(range(1, 11))->each(function (int $number): void {
            Customer::query()->create([
                'name' => 'Nilo '.$number,
                'phone_whatsapp' => '08222'.$number,
            ]);
        });

        $this->actingAs($admin)
            ->get(route('admin.customers.index', [
                'search' => 'Nilo',
                'per_page' => 10,
                'page' => 2,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/customers/index')
                ->where('customerFilters.search', 'Nilo')
                ->where('customerPagination.per_page', 10)
                ->where('customerPagination.current_page', 2)
                ->where('customerPagination.total', 11)
                ->has('customers', 1)
                ->where('customers.0.name', 'Nilo 9'));
    }

    public function test_season_rule_index_can_filter_by_dp_and_status(): void
    {
        $admin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);

        SeasonRule::query()->create([
            'name' => 'Regular Season',
            'start_date' => '2026-05-01',
            'end_date' => '2026-05-31',
            'dp_required' => false,
            'active' => true,
        ]);

        SeasonRule::query()->create([
            'name' => 'High Season Nonaktif',
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-10',
            'dp_required' => true,
            'dp_type' => 'percentage',
            'dp_value' => 50,
            'active' => false,
        ]);

        SeasonRule::query()->create([
            'name' => 'High Season Aktif',
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-10',
            'dp_required' => true,
            'dp_type' => 'percentage',
            'dp_value' => 50,
            'active' => true,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.season-rules.index', [
                'search' => 'High Season',
                'status' => 'active',
                'dp_required' => 'required',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/season-rules/index')
                ->where('seasonRuleFilters.search', 'High Season')
                ->where('seasonRuleFilters.status', 'active')
                ->where('seasonRuleFilters.dp_required', 'required')
                ->where('seasonRulePagination.total', 1)
                ->has('seasonRules', 1)
                ->where('seasonRules.0.name', 'High Season Aktif'));
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
