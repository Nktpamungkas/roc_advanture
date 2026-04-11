<?php

namespace Tests\Feature\Admin;

use App\Models\CombinedOrder;
use App\Models\InventoryUnit;
use App\Models\PaymentMethodConfig;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleProduct;
use App\Models\User;
use App\Models\WaLog;
use App\Support\Access\RoleNames;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
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

    public function test_admin_toko_can_send_combined_order_invoice_via_whatsapp(): void
    {
        config([
            'services.whatsapp.enabled' => true,
            'services.whatsapp.api_url' => 'https://api.fonnte.com/send',
            'services.whatsapp.token' => 'testing-token',
            'services.whatsapp.timeout' => 10,
            'services.whatsapp.auth_mode' => 'header',
            'services.whatsapp.auth_header' => 'Authorization',
            'services.whatsapp.field_phone' => 'target',
            'services.whatsapp.field_message' => 'message',
            'services.whatsapp.field_token' => 'token',
        ]);

        Http::fake([
            'https://api.fonnte.com/send' => Http::response([
                'status' => true,
                'id' => 'fonnte-combined-001',
            ], 200),
        ]);

        [$admin, $combinedOrder] = $this->createCombinedOrder();

        $response = $this->actingAs($admin)->post(route('admin.combined-orders.send-invoice-whatsapp', $combinedOrder));

        $response->assertRedirect(route('admin.combined-orders.show', $combinedOrder));
        $response->assertSessionHas('success', 'Invoice gabungan berhasil dikirim ke WhatsApp customer.');

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.fonnte.com/send'
                && $request->hasHeader('Authorization', 'testing-token')
                && $request->isForm()
                && $request['target'] === '6281200000111'
                && str_contains((string) $request['message'], 'Invoice Gabungan Roc Advanture')
                && str_contains((string) $request['message'], 'Item Sewa:')
                && str_contains((string) $request['message'], 'Item Jual:');
        });

        $this->assertDatabaseHas('wa_logs', [
            'rental_id' => $combinedOrder->rentals()->firstOrFail()->id,
            'message_type' => 'combined_order_invoice_manual',
            'status' => 'sent',
            'provider_message_id' => 'fonnte-combined-001',
        ]);
    }

    public function test_admin_toko_can_update_combined_order_and_recalculate_stocks(): void
    {
        [$admin, $combinedOrder, $paymentMethod, $unitA, $saleProduct] = $this->createCombinedOrderWithContext();

        $unitB = InventoryUnit::query()->create([
            'product_id' => $unitA->product_id,
            'unit_code' => 'CAR50-002',
            'status' => InventoryUnitStatuses::READY_UNCLEAN,
        ]);

        $response = $this->actingAs($admin)->put(route('admin.combined-orders.update', $combinedOrder), [
            'customer_id' => '',
            'customer_name' => 'Akim Update',
            'customer_phone_whatsapp' => '081200000111',
            'customer_address' => 'Cikupa Update',
            'guarantee_note' => 'SIM C',
            'starts_at' => '2026-04-05 12:00:00',
            'due_at' => '2026-04-07 12:00:00',
            'rental_days' => 2,
            'inventory_unit_ids' => [$unitB->id],
            'sale_items' => [
                ['sale_product_id' => $saleProduct->id, 'qty' => 3],
            ],
            'payment_method_config_id' => $paymentMethod->id,
            'paid_amount' => 325000,
            'dp_override_reason' => '',
            'notes' => 'Edited combined order',
        ]);

        $response->assertRedirect(route('admin.combined-orders.show', $combinedOrder));
        $response->assertSessionHas('success', 'Perubahan transaksi gabungan berhasil disimpan.');

        $combinedOrder->refresh();
        $rental = $combinedOrder->rentals()->firstOrFail();
        $sale = $combinedOrder->sales()->firstOrFail();

        $this->assertDatabaseHas('combined_orders', [
            'id' => $combinedOrder->id,
            'customer_name' => 'Akim Update',
            'rental_total' => 100000,
            'sale_total' => 225000,
            'subtotal' => 325000,
            'paid_amount' => 325000,
            'remaining_amount' => 0,
        ]);

        $this->assertDatabaseHas('rentals', [
            'id' => $rental->id,
            'customer_id' => $rental->customer_id,
            'guarantee_note' => 'SIM C',
            'subtotal' => 100000,
            'paid_amount' => 100000,
            'remaining_amount' => 0,
            'payment_status' => RentalPaymentStatuses::PAID,
        ]);

        $this->assertDatabaseHas('inventory_units', [
            'id' => $unitA->id,
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $this->assertDatabaseHas('inventory_units', [
            'id' => $unitB->id,
            'status' => InventoryUnitStatuses::RENTED,
        ]);

        $this->assertDatabaseHas('sale_products', [
            'id' => $saleProduct->id,
            'stock_qty' => 2,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'sale_product_id' => $saleProduct->id,
            'reference_type' => 'combined_sale_edit_revert',
            'reference_id' => $sale->id,
            'movement_type' => 'adjustment',
            'qty' => 2,
            'stock_before' => 3,
            'stock_after' => 5,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'sale_product_id' => $saleProduct->id,
            'reference_type' => 'combined_sale_edit_apply',
            'reference_id' => $sale->id,
            'movement_type' => 'out',
            'qty' => 3,
            'stock_before' => 5,
            'stock_after' => 2,
        ]);
    }

    /**
     * @return array{0: User, 1: CombinedOrder, 2: PaymentMethodConfig, 3: InventoryUnit, 4: SaleProduct}
     */
    private function createCombinedOrderWithContext(): array
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

        $this->actingAs($admin)->post(route('admin.combined-orders.store'), [
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
        ])->assertRedirect();

        return [$admin, CombinedOrder::query()->firstOrFail(), $paymentMethod, $inventoryUnit, $saleProduct];
    }

    /**
     * @return array{0: User, 1: CombinedOrder}
     */
    private function createCombinedOrder(): array
    {
        [$admin, $combinedOrder] = $this->createCombinedOrderWithContext();

        return [$admin, $combinedOrder];
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
