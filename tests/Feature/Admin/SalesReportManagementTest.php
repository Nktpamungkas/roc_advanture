<?php

namespace Tests\Feature\Admin;

use App\Models\PaymentMethodConfig;
use App\Models\Sale;
use App\Models\SaleProduct;
use App\Models\User;
use App\Support\Access\RoleNames;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SalesReportManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_sales_report_page(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.sales-reports.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_sales_report_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.sales-reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/reports/sales/index'));
    }

    public function test_sales_report_page_filters_sales_and_shows_sales_data(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'QRIS Toko',
            'type' => 'qris',
            'code' => 'qris-toko',
            'active' => true,
        ]);

        $topProduct = SaleProduct::query()->create([
            'sku' => 'MAT001',
            'name' => 'Matras Summit',
            'category' => 'Matras',
            'purchase_price' => 50000,
            'selling_price' => 75000,
            'stock_qty' => 1,
            'min_stock_qty' => 3,
            'active' => true,
        ]);

        $otherProduct = SaleProduct::query()->create([
            'sku' => 'SB001',
            'name' => 'Sleeping Bag Outdoor',
            'category' => 'Sleeping Bag',
            'purchase_price' => 90000,
            'selling_price' => 125000,
            'stock_qty' => 8,
            'min_stock_qty' => 2,
            'active' => true,
        ]);

        $saleInRange = Sale::query()->create([
            'sale_no' => 'ROC-SALE-20260330-0001',
            'sold_at' => '2026-03-30 09:00:00',
            'sold_by' => $admin->id,
            'customer_name' => 'Nilo',
            'customer_phone' => '081234567890',
            'subtotal' => 150000,
            'discount_amount' => 10000,
            'total_amount' => 140000,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'QRIS Toko',
            'payment_method_type_snapshot' => 'qris',
        ]);

        $saleInRange->items()->create([
            'sale_product_id' => $topProduct->id,
            'product_name_snapshot' => 'Matras Summit',
            'sku_snapshot' => 'MAT001',
            'selling_price_snapshot' => 75000,
            'qty' => 2,
            'line_total' => 150000,
        ]);

        $saleOutOfRange = Sale::query()->create([
            'sale_no' => 'ROC-SALE-20260215-0001',
            'sold_at' => '2026-02-15 11:00:00',
            'sold_by' => $admin->id,
            'customer_name' => 'Budi',
            'customer_phone' => '081200000002',
            'subtotal' => 125000,
            'discount_amount' => 0,
            'total_amount' => 125000,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'QRIS Toko',
            'payment_method_type_snapshot' => 'qris',
        ]);

        $saleOutOfRange->items()->create([
            'sale_product_id' => $otherProduct->id,
            'product_name_snapshot' => 'Sleeping Bag Outdoor',
            'sku_snapshot' => 'SB001',
            'selling_price_snapshot' => 125000,
            'qty' => 1,
            'line_total' => 125000,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.sales-reports.index', [
                'search' => 'Nilo',
                'date_from' => '2026-03-01',
                'date_to' => '2026-03-31',
                'payment_method_config_id' => $paymentMethod->id,
                'per_page' => 10,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/reports/sales/index')
                ->where('salesReportFilters.search', 'Nilo')
                ->where('salesSummary.transactions_in_period', 1)
                ->where('salesSummary.revenue_in_period', 140000)
                ->where('salesSummary.discount_in_period', 10000)
                ->where('salesSummary.items_sold_in_period', 2)
                ->where('salesSummary.low_stock_count', 1)
                ->has('sales', 1)
                ->where('sales.0.sale_no', 'ROC-SALE-20260330-0001')
                ->has('topProducts', 1)
                ->where('topProducts.0.sku', 'MAT001')
                ->has('lowStockProducts', 1)
                ->where('lowStockProducts.0.sku', 'MAT001'));
    }

    public function test_admin_toko_can_export_sales_report_as_csv(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'Cash Toko',
            'type' => 'cash',
            'code' => 'cash-toko',
            'active' => true,
        ]);

        Sale::query()->create([
            'sale_no' => 'ROC-SALE-20260330-0001',
            'sold_at' => '2026-03-30 09:00:00',
            'sold_by' => $admin->id,
            'customer_name' => 'Nilo',
            'customer_phone' => '081234567890',
            'subtotal' => 150000,
            'discount_amount' => 0,
            'total_amount' => 150000,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'Cash Toko',
            'payment_method_type_snapshot' => 'cash',
        ]);

        $response = $this->actingAs($admin)->get(route('admin.sales-reports.export', [
            'report' => 'sales',
            'format' => 'csv',
            'date_from' => '2026-03-01',
            'date_to' => '2026-03-31',
        ]));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('ROC-SALE-20260330-0001', $response->streamedContent());
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
