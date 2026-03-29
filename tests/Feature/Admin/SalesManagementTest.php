<?php

namespace Tests\Feature\Admin;

use App\Models\PaymentMethodConfig;
use App\Models\Sale;
use App\Models\SaleProduct;
use App\Models\StockReceipt;
use App\Models\User;
use App\Support\Access\RoleNames;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SalesManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_sales_pages(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.sale-products.index'))->assertForbidden();
        $this->actingAs($staff)->get(route('admin.stock-receipts.index'))->assertForbidden();
        $this->actingAs($staff)->get(route('admin.sales.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_sales_pages(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.sale-products.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/sale-products/index'));

        $this->actingAs($admin)
            ->get(route('admin.stock-receipts.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/stock-receipts/index'));

        $this->actingAs($admin)
            ->get(route('admin.sales.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/sales/index'));
    }

    public function test_admin_toko_can_create_sale_product_and_stock_receipt(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)->post(route('admin.sale-products.store'), [
            'sku' => 'MAT001',
            'name' => 'Matras Summit',
            'category' => 'Matras',
            'purchase_price' => 55000,
            'selling_price' => 85000,
            'min_stock_qty' => 3,
            'active' => true,
            'notes' => 'Produk jual cepat.',
        ])->assertRedirect(route('admin.sale-products.index'));

        $saleProduct = SaleProduct::query()->firstOrFail();

        $this->assertDatabaseHas('sale_products', [
            'id' => $saleProduct->id,
            'sku' => 'MAT001',
            'name' => 'Matras Summit',
            'stock_qty' => 0,
        ]);

        $this->actingAs($admin)->post(route('admin.stock-receipts.store'), [
            'supplier_name' => 'Gudang Pusat',
            'received_at' => '2026-03-29 10:00:00',
            'notes' => 'Batch awal',
            'items' => [
                [
                    'sale_product_id' => $saleProduct->id,
                    'qty' => 10,
                    'purchase_price' => 60000,
                ],
            ],
        ])->assertRedirect(route('admin.stock-receipts.index'));

        $receipt = StockReceipt::query()->firstOrFail();

        $this->assertDatabaseHas('stock_receipts', [
            'id' => $receipt->id,
            'supplier_name' => 'Gudang Pusat',
            'received_by' => $admin->id,
        ]);

        $this->assertDatabaseHas('stock_receipt_items', [
            'stock_receipt_id' => $receipt->id,
            'sale_product_id' => $saleProduct->id,
            'qty' => 10,
            'purchase_price' => 60000,
        ]);

        $this->assertDatabaseHas('sale_products', [
            'id' => $saleProduct->id,
            'stock_qty' => 10,
            'purchase_price' => 60000,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'sale_product_id' => $saleProduct->id,
            'reference_type' => 'stock_receipt',
            'reference_id' => $receipt->id,
            'movement_type' => 'in',
            'qty' => 10,
            'stock_before' => 0,
            'stock_after' => 10,
        ]);
    }

    public function test_admin_toko_can_create_sale_and_stock_decreases(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'Cash Kasir',
            'type' => 'cash',
            'code' => 'cash-kasir',
            'active' => true,
        ]);

        $saleProduct = SaleProduct::query()->create([
            'sku' => 'SB001',
            'name' => 'Sleeping Bag Outdoor',
            'category' => 'Sleeping Bag',
            'purchase_price' => 90000,
            'selling_price' => 125000,
            'stock_qty' => 8,
            'min_stock_qty' => 2,
            'active' => true,
        ]);

        $response = $this->actingAs($admin)->post(route('admin.sales.store'), [
            'sold_at' => '2026-03-29 12:00:00',
            'customer_name' => 'Raka',
            'customer_phone' => '081234567890',
            'discount_amount' => 5000,
            'payment_method_config_id' => $paymentMethod->id,
            'notes' => 'Penjualan toko depan',
            'items' => [
                [
                    'sale_product_id' => $saleProduct->id,
                    'qty' => 2,
                ],
            ],
        ]);

        $sale = Sale::query()->firstOrFail();

        $response->assertRedirect(route('admin.sales.show', $sale));

        $this->assertDatabaseHas('sales', [
            'id' => $sale->id,
            'sold_by' => $admin->id,
            'customer_name' => 'Raka',
            'subtotal' => 250000,
            'discount_amount' => 5000,
            'total_amount' => 245000,
            'payment_method_config_id' => $paymentMethod->id,
        ]);

        $this->assertDatabaseHas('sale_items', [
            'sale_id' => $sale->id,
            'sale_product_id' => $saleProduct->id,
            'qty' => 2,
            'selling_price_snapshot' => 125000,
            'line_total' => 250000,
        ]);

        $this->assertDatabaseHas('sale_products', [
            'id' => $saleProduct->id,
            'stock_qty' => 6,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'sale_product_id' => $saleProduct->id,
            'reference_type' => 'sale',
            'reference_id' => $sale->id,
            'movement_type' => 'out',
            'qty' => 2,
            'stock_before' => 8,
            'stock_after' => 6,
        ]);
    }

    public function test_admin_toko_can_open_sale_invoice_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'Transfer BCA',
            'type' => 'transfer',
            'code' => 'transfer-bca',
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'Roc Advanture',
            'active' => true,
        ]);
        $saleProduct = SaleProduct::query()->create([
            'sku' => 'SB001',
            'name' => 'Sleeping Bag Outdoor',
            'category' => 'Sleeping Bag',
            'purchase_price' => 90000,
            'selling_price' => 125000,
            'stock_qty' => 1,
            'min_stock_qty' => 1,
            'active' => true,
        ]);

        $sale = Sale::query()->create([
            'sale_no' => 'ROC-SALE-20260329-0001',
            'sold_at' => '2026-03-29 12:30:00',
            'sold_by' => $admin->id,
            'customer_name' => 'Nilo',
            'customer_phone' => '081234567890',
            'subtotal' => 125000,
            'discount_amount' => 0,
            'total_amount' => 125000,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'Transfer BCA',
            'payment_method_type_snapshot' => 'transfer',
            'payment_transfer_bank_snapshot' => 'BCA',
            'payment_transfer_account_number_snapshot' => '1234567890',
            'payment_transfer_account_name_snapshot' => 'Roc Advanture',
        ]);

        $sale->items()->create([
            'sale_product_id' => $saleProduct->id,
            'product_name_snapshot' => 'Sleeping Bag Outdoor',
            'sku_snapshot' => 'SB001',
            'selling_price_snapshot' => 125000,
            'qty' => 1,
            'line_total' => 125000,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.sales.show', $sale))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/sales/show')
                ->where('sale.sale_no', 'ROC-SALE-20260329-0001')
                ->where('sale.customer_name', 'Nilo')
                ->where('sale.payment_method.name', 'Transfer BCA'));
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
