<?php

namespace Tests\Feature\Admin;

use App\Models\CombinedOrder;
use App\Models\InventoryUnit;
use App\Models\PaymentMethodConfig;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleProduct;
use App\Models\User;
use App\Support\Access\RoleNames;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CombinedOrderManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_admin_toko_can_open_combined_order_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.combined-orders.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/combined-orders/index'));
    }

    public function test_admin_toko_can_create_combined_order_and_update_stocks(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'QRIS Toko',
            'type' => 'qris',
            'code' => 'qris-toko',
            'active' => true,
        ]);

        $rentalProduct = Product::query()->create([
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'daily_rate' => 50000,
            'active' => true,
        ]);

        $inventoryUnit = InventoryUnit::query()->create([
            'product_id' => $rentalProduct->id,
            'unit_code' => 'CAR50-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $saleProduct = SaleProduct::query()->create([
            'sku' => 'MAT001',
            'name' => 'Matras Summit',
            'category' => 'Matras',
            'purchase_price' => 35000,
            'selling_price' => 75000,
            'stock_qty' => 5,
            'min_stock_qty' => 1,
            'active' => true,
        ]);

        $response = $this->actingAs($admin)->post(route('admin.combined-orders.store'), [
            'customer_name' => 'Akim',
            'customer_phone_whatsapp' => '081200000111',
            'customer_address' => 'Cikupa',
            'guarantee_note' => 'KTP',
            'starts_at' => '2026-04-05 10:00:00',
            'due_at' => '2026-04-06 10:00:00',
            'rental_days' => 1,
            'inventory_unit_ids' => [$inventoryUnit->id],
            'sale_items' => [
                ['sale_product_id' => $saleProduct->id, 'qty' => 2],
            ],
            'payment_method_config_id' => $paymentMethod->id,
            'paid_amount' => 200000,
            'notes' => 'Gabungan sewa dan jual',
        ]);

        $combinedOrder = CombinedOrder::query()->firstOrFail();
        $rental = $combinedOrder->rentals()->firstOrFail();
        $sale = $combinedOrder->sales()->firstOrFail();

        $response->assertRedirect(route('admin.combined-orders.show', $combinedOrder));

        $this->assertDatabaseHas('combined_orders', [
            'id' => $combinedOrder->id,
            'created_by' => $admin->id,
            'customer_name' => 'Akim',
            'rental_total' => 50000,
            'sale_total' => 150000,
            'subtotal' => 200000,
            'paid_amount' => 200000,
            'remaining_amount' => 0,
            'payment_status' => 'paid',
        ]);

        $this->assertDatabaseHas('rentals', [
            'id' => $rental->id,
            'combined_order_id' => $combinedOrder->id,
            'payment_status' => RentalPaymentStatuses::PAID,
            'rental_status' => RentalStatuses::PICKED_UP,
            'guarantee_note' => 'KTP',
        ]);

        $this->assertDatabaseHas('sales', [
            'id' => $sale->id,
            'combined_order_id' => $combinedOrder->id,
            'customer_name' => 'Akim',
            'total_amount' => 150000,
        ]);

        $this->assertDatabaseHas('inventory_units', [
            'id' => $inventoryUnit->id,
            'status' => InventoryUnitStatuses::RENTED,
        ]);

        $this->assertDatabaseHas('sale_products', [
            'id' => $saleProduct->id,
            'stock_qty' => 3,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'sale_product_id' => $saleProduct->id,
            'reference_type' => 'combined_sale',
            'reference_id' => $sale->id,
            'movement_type' => 'out',
            'qty' => 2,
            'stock_before' => 5,
            'stock_after' => 3,
        ]);
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}