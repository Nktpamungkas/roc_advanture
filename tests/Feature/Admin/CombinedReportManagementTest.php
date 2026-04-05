<?php

namespace Tests\Feature\Admin;

use App\Models\CombinedOrder;
use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\PaymentMethodConfig;
use App\Models\Product;
use App\Models\Rental;
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

class CombinedReportManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_combined_report_page(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.combined-reports.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_combined_report_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.combined-reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/reports/combined/index'));
    }

    public function test_combined_report_merges_rental_sale_and_combined_transactions(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'QRIS Gabungan',
            'type' => 'qris',
            'code' => 'qris-gabungan',
            'active' => true,
        ]);

        $customer = Customer::query()->create([
            'name' => 'Nilo Gabungan',
            'phone_whatsapp' => '081200000001',
        ]);

        $rentalProduct = Product::query()->create([
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'daily_rate' => 75000,
            'active' => true,
        ]);

        $rentalUnit = InventoryUnit::query()->create([
            'product_id' => $rentalProduct->id,
            'unit_code' => 'CAR50-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $saleProduct = SaleProduct::query()->create([
            'sku' => 'MAT001',
            'name' => 'Matras Summit',
            'category' => 'Matras',
            'purchase_price' => 50000,
            'selling_price' => 75000,
            'stock_qty' => 5,
            'min_stock_qty' => 2,
            'active' => true,
        ]);

        $combinedOrder = CombinedOrder::query()->create([
            'combined_no' => 'ROC-CMB-20260330-0001',
            'ordered_at' => '2026-03-30 18:00:00',
            'created_by' => $admin->id,
            'customer_name' => 'Nilo Gabungan',
            'customer_phone' => '081200000001',
            'payment_method_config_id' => $paymentMethod->id,
            'rental_total' => 150000,
            'sale_total' => 75000,
            'subtotal' => 225000,
            'discount_amount' => 5000,
            'paid_amount' => 200000,
            'remaining_amount' => 20000,
            'payment_status' => 'dp_paid',
            'payment_method_name_snapshot' => 'QRIS Gabungan',
            'payment_method_type_snapshot' => 'qris',
            'notes' => 'Gabungan rental dan jual',
        ]);

        $linkedRental = Rental::query()->create([
            'rental_no' => 'ROC-RENT-20260330-0001',
            'customer_id' => $customer->id,
            'combined_order_id' => $combinedOrder->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-03-30 10:00:00',
            'due_at' => '2026-03-31 10:00:00',
            'total_days' => 1,
            'subtotal' => 150000,
            'paid_amount' => 50000,
            'remaining_amount' => 100000,
            'payment_status' => RentalPaymentStatuses::DP_PAID,
            'rental_status' => RentalStatuses::PICKED_UP,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'QRIS Gabungan',
            'payment_method_type_snapshot' => 'qris',
        ]);

        $linkedRental->items()->create([
            'inventory_unit_id' => $rentalUnit->id,
            'product_name_snapshot' => 'Carrier 50L',
            'daily_rate_snapshot' => 75000,
            'days' => 2,
            'line_total' => 150000,
            'status_at_checkout' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $linkedSale = Sale::query()->create([
            'sale_no' => 'ROC-SALE-20260330-0001',
            'sold_at' => '2026-03-30 18:10:00',
            'sold_by' => $admin->id,
            'combined_order_id' => $combinedOrder->id,
            'customer_name' => 'Nilo Gabungan',
            'customer_phone' => '081200000001',
            'subtotal' => 75000,
            'discount_amount' => 0,
            'total_amount' => 75000,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'QRIS Gabungan',
            'payment_method_type_snapshot' => 'qris',
        ]);

        $linkedSale->items()->create([
            'sale_product_id' => $saleProduct->id,
            'product_name_snapshot' => 'Matras Summit',
            'sku_snapshot' => 'MAT001',
            'selling_price_snapshot' => 75000,
            'qty' => 1,
            'line_total' => 75000,
        ]);

        $standaloneRental = Rental::query()->create([
            'rental_no' => 'ROC-RENT-20260329-0001',
            'customer_id' => $customer->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-03-29 09:00:00',
            'due_at' => '2026-03-30 09:00:00',
            'total_days' => 1,
            'subtotal' => 100000,
            'paid_amount' => 100000,
            'remaining_amount' => 0,
            'payment_status' => RentalPaymentStatuses::PAID,
            'rental_status' => RentalStatuses::PICKED_UP,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'QRIS Gabungan',
            'payment_method_type_snapshot' => 'qris',
        ]);

        $standaloneRental->items()->create([
            'inventory_unit_id' => $rentalUnit->id,
            'product_name_snapshot' => 'Carrier 50L',
            'daily_rate_snapshot' => 100000,
            'days' => 1,
            'line_total' => 100000,
            'status_at_checkout' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $standaloneSale = Sale::query()->create([
            'sale_no' => 'ROC-SALE-20260329-0002',
            'sold_at' => '2026-03-29 11:00:00',
            'sold_by' => $admin->id,
            'customer_name' => 'Budi Jual',
            'customer_phone' => '081200000002',
            'subtotal' => 125000,
            'discount_amount' => 0,
            'total_amount' => 125000,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'QRIS Gabungan',
            'payment_method_type_snapshot' => 'qris',
        ]);

        $standaloneSale->items()->create([
            'sale_product_id' => $saleProduct->id,
            'product_name_snapshot' => 'Matras Summit',
            'sku_snapshot' => 'MAT001',
            'selling_price_snapshot' => 125000,
            'qty' => 1,
            'line_total' => 125000,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.combined-reports.index', [
                'date_from' => '2026-03-29',
                'date_to' => '2026-03-31',
                'per_page' => 10,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/reports/combined/index')
                ->where('reportSummary.transactions_total', 3)
                ->where('reportSummary.combined_total', 1)
                ->where('reportSummary.rental_total', 1)
                ->where('reportSummary.sale_total', 1)
                ->where('reportSummary.grand_total_amount', 445000)
                ->where('reportSummary.remaining_total_amount', 20000)
                ->has('transactions', 3)
                ->where('transactions.0.source_type', 'combined')
                ->where('transactions.0.reference_no', 'ROC-CMB-20260330-0001')
                ->where('transactions.1.source_type', 'sale')
                ->where('transactions.2.source_type', 'rental'));
    }

    public function test_admin_toko_can_export_combined_report_as_csv(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'Cash Gabungan',
            'type' => 'cash',
            'code' => 'cash-gabungan',
            'active' => true,
        ]);

        $combinedOrder = CombinedOrder::query()->create([
            'combined_no' => 'ROC-CMB-20260330-0001',
            'ordered_at' => '2026-03-30 18:00:00',
            'created_by' => $admin->id,
            'customer_name' => 'Nilo Gabungan',
            'customer_phone' => '081200000001',
            'payment_method_config_id' => $paymentMethod->id,
            'rental_total' => 150000,
            'sale_total' => 75000,
            'subtotal' => 225000,
            'discount_amount' => 0,
            'paid_amount' => 225000,
            'remaining_amount' => 0,
            'payment_status' => 'paid',
            'payment_method_name_snapshot' => 'Cash Gabungan',
            'payment_method_type_snapshot' => 'cash',
        ]);

        $customer = Customer::query()->create([
            'name' => 'Nilo Gabungan',
            'phone_whatsapp' => '081200000001',
        ]);

        $rentalProduct = Product::query()->create([
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'daily_rate' => 75000,
            'active' => true,
        ]);

        $rentalUnit = InventoryUnit::query()->create([
            'product_id' => $rentalProduct->id,
            'unit_code' => 'CAR50-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $saleProduct = SaleProduct::query()->create([
            'sku' => 'MAT001',
            'name' => 'Matras Summit',
            'category' => 'Matras',
            'purchase_price' => 50000,
            'selling_price' => 75000,
            'stock_qty' => 5,
            'min_stock_qty' => 2,
            'active' => true,
        ]);

        $rental = Rental::query()->create([
            'rental_no' => 'ROC-RENT-20260330-0001',
            'customer_id' => $customer->id,
            'combined_order_id' => $combinedOrder->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-03-30 10:00:00',
            'due_at' => '2026-03-31 10:00:00',
            'total_days' => 1,
            'subtotal' => 150000,
            'paid_amount' => 150000,
            'remaining_amount' => 0,
            'payment_status' => RentalPaymentStatuses::PAID,
            'rental_status' => RentalStatuses::PICKED_UP,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'Cash Gabungan',
            'payment_method_type_snapshot' => 'cash',
        ]);

        $rental->items()->create([
            'inventory_unit_id' => $rentalUnit->id,
            'product_name_snapshot' => 'Carrier 50L',
            'daily_rate_snapshot' => 150000,
            'days' => 1,
            'line_total' => 150000,
            'status_at_checkout' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $sale = Sale::query()->create([
            'sale_no' => 'ROC-SALE-20260330-0001',
            'sold_at' => '2026-03-30 18:10:00',
            'sold_by' => $admin->id,
            'combined_order_id' => $combinedOrder->id,
            'customer_name' => 'Nilo Gabungan',
            'customer_phone' => '081200000001',
            'subtotal' => 75000,
            'discount_amount' => 0,
            'total_amount' => 75000,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'Cash Gabungan',
            'payment_method_type_snapshot' => 'cash',
        ]);

        $sale->items()->create([
            'sale_product_id' => $saleProduct->id,
            'product_name_snapshot' => 'Matras Summit',
            'sku_snapshot' => 'MAT001',
            'selling_price_snapshot' => 75000,
            'qty' => 1,
            'line_total' => 75000,
        ]);

        $standaloneRental = Rental::query()->create([
            'rental_no' => 'ROC-RENT-20260329-0001',
            'customer_id' => $customer->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-03-29 09:00:00',
            'due_at' => '2026-03-30 09:00:00',
            'total_days' => 1,
            'subtotal' => 100000,
            'paid_amount' => 100000,
            'remaining_amount' => 0,
            'payment_status' => RentalPaymentStatuses::PAID,
            'rental_status' => RentalStatuses::PICKED_UP,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'Cash Gabungan',
            'payment_method_type_snapshot' => 'cash',
        ]);

        $standaloneRental->items()->create([
            'inventory_unit_id' => $rentalUnit->id,
            'product_name_snapshot' => 'Carrier 50L',
            'daily_rate_snapshot' => 100000,
            'days' => 1,
            'line_total' => 100000,
            'status_at_checkout' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $standaloneSale = Sale::query()->create([
            'sale_no' => 'ROC-SALE-20260329-0002',
            'sold_at' => '2026-03-29 11:00:00',
            'sold_by' => $admin->id,
            'customer_name' => 'Budi Jual',
            'customer_phone' => '081200000002',
            'subtotal' => 125000,
            'discount_amount' => 0,
            'total_amount' => 125000,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_method_name_snapshot' => 'Cash Gabungan',
            'payment_method_type_snapshot' => 'cash',
        ]);

        $standaloneSale->items()->create([
            'sale_product_id' => $saleProduct->id,
            'product_name_snapshot' => 'Matras Summit',
            'sku_snapshot' => 'MAT001',
            'selling_price_snapshot' => 125000,
            'qty' => 1,
            'line_total' => 125000,
        ]);

        $response = $this->actingAs($admin)->get(route('admin.combined-reports.export', [
            'format' => 'csv',
            'date_from' => '2026-03-29',
            'date_to' => '2026-03-31',
        ]));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $content = $response->streamedContent();

        $this->assertStringContainsString('ROC-CMB-20260330-0001', $content);
        $this->assertStringContainsString('ROC-RENT-20260329-0001', $content);
        $this->assertStringContainsString('ROC-SALE-20260329-0002', $content);
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
