<?php

namespace Tests\Feature\Admin;

use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\PaymentMethodConfig;
use App\Models\Product;
use App\Models\Rental;
use App\Models\SeasonRule;
use App\Models\User;
use App\Support\Access\RoleNames;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentKinds;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RentalManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_rental_pages(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.rentals.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_rental_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.rentals.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/rentals/index'));
    }

    public function test_admin_toko_can_create_rental_and_units_become_rented(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $customer = Customer::query()->create([
            'name' => 'Customer A',
            'phone_whatsapp' => '081234567890',
        ]);

        $product = Product::query()->create([
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'prefix_code' => 'CAR50',
            'daily_rate' => 75000,
            'active' => true,
        ]);

        $cleanUnit = InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'CAR50-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $uncleanUnit = InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'CAR50-002',
            'status' => InventoryUnitStatuses::READY_UNCLEAN,
        ]);

        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'Kasir Tunai',
            'type' => 'cash',
            'code' => 'cash',
            'active' => true,
        ]);

        $response = $this->actingAs($admin)->post(route('admin.rentals.store'), [
            'customer_id' => $customer->id,
            'starts_at' => '2026-04-01 19:00:00',
            'rental_days' => 2,
            'inventory_unit_ids' => [$cleanUnit->id, $uncleanUnit->id],
            'paid_amount' => 100000,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_notes' => 'DP cash di awal',
            'guarantee_note' => 'KTP Asli',
            'notes' => 'Customer ambil malam hari.',
        ]);

        $rental = Rental::query()->firstOrFail();

        $response->assertRedirect(route('admin.rentals.show', $rental));

        $this->assertDatabaseHas('rentals', [
            'id' => $rental->id,
            'customer_id' => $customer->id,
            'total_days' => 2,
            'subtotal' => 300000,
            'paid_amount' => 100000,
            'remaining_amount' => 200000,
            'payment_status' => RentalPaymentStatuses::DP_PAID,
            'rental_status' => RentalStatuses::PICKED_UP,
            'guarantee_note' => 'KTP Asli',
        ]);

        $this->assertDatabaseHas('rental_items', [
            'rental_id' => $rental->id,
            'inventory_unit_id' => $cleanUnit->id,
            'status_at_checkout' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $this->assertDatabaseHas('rental_items', [
            'rental_id' => $rental->id,
            'inventory_unit_id' => $uncleanUnit->id,
            'status_at_checkout' => InventoryUnitStatuses::READY_UNCLEAN,
        ]);

        $this->assertDatabaseHas('payments', [
            'rental_id' => $rental->id,
            'received_by' => $admin->id,
            'payment_method_config_id' => $paymentMethod->id,
            'payment_kind' => PaymentKinds::DP,
            'amount' => 100000,
            'method' => 'cash',
        ]);

        $this->assertDatabaseHas('inventory_units', [
            'id' => $cleanUnit->id,
            'status' => InventoryUnitStatuses::RENTED,
        ]);

        $this->assertDatabaseHas('inventory_units', [
            'id' => $uncleanUnit->id,
            'status' => InventoryUnitStatuses::RENTED,
        ]);
    }

    public function test_high_season_rental_requires_minimum_dp(): void
    {
        $admin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);
        $customer = Customer::query()->create([
            'name' => 'Customer B',
            'phone_whatsapp' => '082222222222',
        ]);

        $product = Product::query()->create([
            'name' => 'Tenda 4P',
            'category' => 'Tenda',
            'prefix_code' => 'TND4P',
            'daily_rate' => 100000,
            'active' => true,
        ]);

        $unit = InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'TND4P-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'Transfer BCA',
            'type' => 'transfer',
            'code' => 'bca-transfer',
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'Roc Advanture',
            'active' => true,
        ]);

        SeasonRule::query()->create([
            'name' => 'High Season Lebaran',
            'start_date' => '2026-04-01',
            'end_date' => '2026-04-10',
            'dp_required' => true,
            'dp_type' => 'percentage',
            'dp_value' => 50,
            'active' => true,
        ]);

        $this->from(route('admin.rentals.index'))
            ->actingAs($admin)
            ->post(route('admin.rentals.store'), [
                'customer_id' => $customer->id,
                'starts_at' => '2026-04-05 08:00:00',
                'rental_days' => 2,
                'inventory_unit_ids' => [$unit->id],
                'paid_amount' => 50000,
                'payment_method_config_id' => $paymentMethod->id,
            ])
            ->assertRedirect(route('admin.rentals.index'))
            ->assertSessionHasErrors('dp_override_reason');

        $this->assertDatabaseCount('rentals', 0);
        $this->assertDatabaseHas('inventory_units', [
            'id' => $unit->id,
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);
    }

    public function test_high_season_rental_can_be_overridden_with_reason_and_customer_created_from_form(): void
    {
        $admin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);

        $product = Product::query()->create([
            'name' => 'Flysheet 4x6',
            'category' => 'Flysheet',
            'prefix_code' => 'FLS46',
            'daily_rate' => 15000,
            'active' => true,
        ]);

        $unit = InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'FLS46-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'QRIS Toko',
            'type' => 'qris',
            'code' => 'qris-toko',
            'qr_image_path' => '/uploads/payment-methods/qris.png',
            'active' => true,
        ]);

        SeasonRule::query()->create([
            'name' => 'High Season Lebaran',
            'start_date' => '2026-04-01',
            'end_date' => '2026-04-10',
            'dp_required' => true,
            'dp_type' => 'percentage',
            'dp_value' => 50,
            'active' => true,
        ]);

        $response = $this->actingAs($admin)->post(route('admin.rentals.store'), [
            'customer_name' => 'Customer Override',
            'customer_phone_whatsapp' => '089999999999',
            'customer_address' => 'Cikupa',
            'starts_at' => '2026-04-05 08:00:00',
            'rental_days' => 2,
            'inventory_unit_ids' => [$unit->id],
            'paid_amount' => 0,
            'payment_method_config_id' => $paymentMethod->id,
            'dp_override_reason' => 'Dispensasi owner',
        ]);

        $rental = Rental::query()->firstOrFail();

        $response->assertRedirect(route('admin.rentals.show', $rental));

        $this->assertDatabaseHas('customers', [
            'name' => 'Customer Override',
            'phone_whatsapp' => '089999999999',
        ]);

        $this->assertDatabaseHas('rentals', [
            'id' => $rental->id,
            'dp_override_reason' => 'Dispensasi owner',
            'payment_method_config_id' => $paymentMethod->id,
        ]);
    }

    public function test_admin_can_create_rental_with_manual_due_date_and_past_start_date(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $customer = Customer::query()->create([
            'name' => 'Customer Manual Date',
            'phone_whatsapp' => '081111111111',
        ]);

        $product = Product::query()->create([
            'name' => 'Carrier 40L',
            'category' => 'Carrier',
            'prefix_code' => 'CAR40',
            'daily_rate' => 50000,
            'active' => true,
        ]);

        $unit = InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'CAR40-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $response = $this->actingAs($admin)->post(route('admin.rentals.store'), [
            'customer_id' => $customer->id,
            'starts_at' => '2026-03-20 18:00:00',
            'due_at' => '2026-03-22 18:00:00',
            'inventory_unit_ids' => [$unit->id],
            'paid_amount' => 0,
        ]);

        $rental = Rental::query()->firstOrFail();

        $response->assertRedirect(route('admin.rentals.show', $rental));

        $this->assertDatabaseHas('rentals', [
            'id' => $rental->id,
            'starts_at' => '2026-03-20 18:00:00',
            'due_at' => '2026-03-22 18:00:00',
            'total_days' => 2,
            'subtotal' => 100000,
        ]);
    }

    public function test_admin_can_view_rental_receipt_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);
        $customer = Customer::query()->create([
            'name' => 'Customer C',
            'phone_whatsapp' => '083333333333',
        ]);

        $rental = Rental::query()->create([
            'rental_no' => 'ROC-RENT-20260329-0001',
            'customer_id' => $customer->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-04-01 10:00:00',
            'due_at' => '2026-04-02 10:00:00',
            'total_days' => 1,
            'dp_required' => false,
            'subtotal' => 75000,
            'dp_amount' => 0,
            'paid_amount' => 75000,
            'remaining_amount' => 0,
            'payment_status' => RentalPaymentStatuses::PAID,
            'rental_status' => RentalStatuses::PICKED_UP,
            'guarantee_note' => 'SIM C',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.rentals.show', $rental))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/rentals/show')
                ->where('rental.rental_no', 'ROC-RENT-20260329-0001')
                ->where('rental.customer.name', 'Customer C')
                ->where('rental.guarantee_note', 'SIM C'));
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
