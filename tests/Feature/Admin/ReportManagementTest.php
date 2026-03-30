<?php

namespace Tests\Feature\Admin;

use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Rental;
use App\Models\User;
use App\Support\Access\RoleNames;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentKinds;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ReportManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_report_page(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.rental-reports.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_report_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.rental-reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/reports/rentals/index'));
    }

    public function test_report_page_filters_rentals_and_shows_operational_data(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $customerA = Customer::query()->create([
            'name' => 'Nilo Outdoor',
            'phone_whatsapp' => '081200000001',
        ]);
        $customerB = Customer::query()->create([
            'name' => 'Budi Camp',
            'phone_whatsapp' => '081200000002',
        ]);

        $product = Product::query()->create([
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'daily_rate' => 75000,
            'active' => true,
        ]);

        InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'CAR50-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'CAR50-002',
            'status' => InventoryUnitStatuses::RENTED,
        ]);

        $rentalInRange = Rental::query()->create([
            'rental_no' => 'ROC-RENT-20260310-0001',
            'customer_id' => $customerA->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-03-10 10:00:00',
            'due_at' => '2026-03-12 10:00:00',
            'total_days' => 2,
            'subtotal' => 150000,
            'paid_amount' => 50000,
            'remaining_amount' => 100000,
            'payment_status' => RentalPaymentStatuses::DP_PAID,
            'rental_status' => RentalStatuses::PICKED_UP,
        ]);

        Rental::query()->create([
            'rental_no' => 'ROC-RENT-20260220-0001',
            'customer_id' => $customerB->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-02-20 10:00:00',
            'due_at' => '2026-02-22 10:00:00',
            'total_days' => 2,
            'subtotal' => 150000,
            'paid_amount' => 150000,
            'remaining_amount' => 0,
            'payment_status' => RentalPaymentStatuses::PAID,
            'rental_status' => RentalStatuses::RETURNED,
        ]);

        Payment::query()->create([
            'rental_id' => $rentalInRange->id,
            'received_by' => $admin->id,
            'payment_kind' => PaymentKinds::DP,
            'amount' => 50000,
            'paid_at' => '2026-03-10 10:15:00',
            'method' => 'cash',
            'method_label_snapshot' => 'Cash',
            'notes' => 'DP awal',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.rental-reports.index', [
                'search' => 'Nilo',
                'date_from' => '2026-03-01',
                'date_to' => '2026-03-31',
                'per_page' => 10,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/reports/rentals/index')
                ->where('reportFilters.search', 'Nilo')
                ->where('reportSummary.rentals_in_period', 1)
                ->where('reportSummary.payments_in_period', 50000)
                ->where('inventorySummary.ready_clean', 1)
                ->where('inventorySummary.rented', 1)
                ->has('rentals', 1)
                ->where('rentals.0.rental_no', 'ROC-RENT-20260310-0001')
                ->has('stockReport', 1)
                ->has('recentPayments', 1)
                ->where('recentPayments.0.rental_no', 'ROC-RENT-20260310-0001'));
    }

    public function test_admin_toko_can_export_rental_report_as_csv(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $customer = Customer::query()->create([
            'name' => 'Nilo Outdoor',
            'phone_whatsapp' => '081200000001',
        ]);

        Rental::query()->create([
            'rental_no' => 'ROC-RENT-20260310-0001',
            'customer_id' => $customer->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-03-10 10:00:00',
            'due_at' => '2026-03-12 10:00:00',
            'total_days' => 2,
            'subtotal' => 150000,
            'paid_amount' => 50000,
            'remaining_amount' => 100000,
            'payment_status' => RentalPaymentStatuses::DP_PAID,
            'rental_status' => RentalStatuses::PICKED_UP,
        ]);

        $response = $this->actingAs($admin)->get(route('admin.rental-reports.export', [
            'report' => 'rentals',
            'format' => 'csv',
            'date_from' => '2026-03-01',
            'date_to' => '2026-03-31',
        ]));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('ROC-RENT-20260310-0001', $response->streamedContent());
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
