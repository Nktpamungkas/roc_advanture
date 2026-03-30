<?php

namespace Tests\Feature\Admin;

use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\SaleProduct;
use App\Models\User;
use App\Support\Access\RoleNames;
use App\Support\Rental\InventoryUnitStatuses;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StockOpnameManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_stock_opname_page(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.stock-opname.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_stock_opname_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.stock-opname.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/stock-opname/index'));
    }

    public function test_admin_toko_can_submit_sale_stock_opname_and_adjust_stock(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $saleProduct = SaleProduct::query()->create([
            'sku' => 'MAT001',
            'name' => 'Matras Summit',
            'category' => 'Matras',
            'purchase_price' => 50000,
            'selling_price' => 80000,
            'stock_qty' => 10,
            'min_stock_qty' => 2,
            'active' => true,
        ]);

        $response = $this->actingAs($admin)->post(route('admin.stock-opname.sales.store'), [
            'performed_at' => '2026-03-30 14:00:00',
            'notes' => 'Opname rak depan',
            'items' => [
                [
                    'sale_product_id' => $saleProduct->id,
                    'physical_qty' => 8,
                ],
            ],
        ]);

        $response->assertRedirect(route('admin.stock-opname.index'));

        $this->assertDatabaseHas('stock_opname_sessions', [
            'domain' => 'sales',
            'created_by' => $admin->id,
            'total_items' => 1,
            'discrepancy_count' => 1,
        ]);

        $this->assertDatabaseHas('stock_opname_sale_items', [
            'sale_product_id' => $saleProduct->id,
            'system_qty' => 10,
            'physical_qty' => 8,
            'difference_qty' => -2,
        ]);

        $this->assertDatabaseHas('sale_products', [
            'id' => $saleProduct->id,
            'stock_qty' => 8,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'sale_product_id' => $saleProduct->id,
            'reference_type' => 'stock_opname',
            'movement_type' => 'adjustment',
            'qty' => 2,
            'stock_before' => 10,
            'stock_after' => 8,
        ]);
    }

    public function test_admin_toko_can_submit_rental_stock_opname_and_adjust_unit_status(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $product = Product::query()->create([
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'daily_rate' => 75000,
            'active' => true,
        ]);

        $inventoryUnit = InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'CAR50-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $response = $this->actingAs($admin)->post(route('admin.stock-opname.rentals.store'), [
            'performed_at' => '2026-03-30 15:00:00',
            'notes' => 'Opname gudang sore',
            'items' => [
                [
                    'inventory_unit_id' => $inventoryUnit->id,
                    'observed_status' => InventoryUnitStatuses::MAINTENANCE,
                ],
            ],
        ]);

        $response->assertRedirect(route('admin.stock-opname.index'));

        $this->assertDatabaseHas('stock_opname_sessions', [
            'domain' => 'rental',
            'created_by' => $admin->id,
            'total_items' => 1,
            'discrepancy_count' => 1,
        ]);

        $this->assertDatabaseHas('stock_opname_rental_items', [
            'inventory_unit_id' => $inventoryUnit->id,
            'system_status' => InventoryUnitStatuses::READY_CLEAN,
            'observed_status' => InventoryUnitStatuses::MAINTENANCE,
            'is_discrepancy' => true,
        ]);

        $this->assertDatabaseHas('inventory_units', [
            'id' => $inventoryUnit->id,
            'status' => InventoryUnitStatuses::MAINTENANCE,
        ]);
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
