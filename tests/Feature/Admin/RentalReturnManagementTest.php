<?php

namespace Tests\Feature\Admin;

use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\PaymentMethodConfig;
use App\Models\Product;
use App\Models\Rental;
use App\Models\User;
use App\Support\Access\RoleNames;
use App\Support\Rental\CompensationTypes;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use App\Support\Rental\ReturnConditions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RentalReturnManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_return_page(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.returns.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_return_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.returns.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/returns/index'));
    }

    public function test_admin_toko_can_process_rental_return_and_update_unit_statuses(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        [$rental, $firstUnit, $secondUnit] = $this->createActiveRental();
        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'Cash Counter',
            'type' => 'cash',
            'code' => 'cash-counter',
            'active' => true,
        ]);

        $response = $this->actingAs($admin)->post(route('admin.returns.store'), [
            'rental_id' => $rental->id,
            'returned_at' => '2026-04-03 20:00:00',
            'settlement_basis' => 'contract',
            'payment_method_config_id' => $paymentMethod->id,
            'payment_notes' => 'Dilunasi saat return.',
            'notes' => 'Semua barang kembali lengkap.',
            'items' => [
                [
                    'rental_item_id' => $rental->items[0]->id,
                    'next_unit_status' => InventoryUnitStatuses::READY_UNCLEAN,
                    'notes' => '',
                ],
                [
                    'rental_item_id' => $rental->items[1]->id,
                    'next_unit_status' => InventoryUnitStatuses::READY_CLEAN,
                    'notes' => '',
                ],
            ],
        ]);

        $response->assertRedirect(route('admin.returns.index'));

        $this->assertDatabaseHas('returns', [
            'rental_id' => $rental->id,
            'checked_by' => $admin->id,
            'charge_basis' => 'contract',
            'settlement_amount' => 480000,
            'notes' => 'Semua barang kembali lengkap.',
        ]);

        $this->assertDatabaseHas('return_items', [
            'rental_item_id' => $rental->items[0]->id,
            'next_unit_status' => InventoryUnitStatuses::READY_UNCLEAN,
            'return_condition' => ReturnConditions::GOOD,
            'compensation_type' => CompensationTypes::NONE,
        ]);

        $this->assertDatabaseHas('return_items', [
            'rental_item_id' => $rental->items[1]->id,
            'next_unit_status' => InventoryUnitStatuses::READY_CLEAN,
            'return_condition' => ReturnConditions::GOOD,
            'compensation_type' => CompensationTypes::NONE,
        ]);

        $this->assertDatabaseHas('inventory_units', [
            'id' => $firstUnit->id,
            'status' => InventoryUnitStatuses::READY_UNCLEAN,
        ]);

        $this->assertDatabaseHas('inventory_units', [
            'id' => $secondUnit->id,
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $this->assertDatabaseHas('rentals', [
            'id' => $rental->id,
            'paid_amount' => 480000,
            'remaining_amount' => 0,
            'payment_status' => RentalPaymentStatuses::PAID,
            'rental_status' => RentalStatuses::RETURNED,
        ]);

        $this->assertDatabaseHas('payments', [
            'rental_id' => $rental->id,
            'payment_kind' => 'settlement',
            'payment_method_config_id' => $paymentMethod->id,
            'amount' => 480000,
        ]);
    }

    public function test_maintenance_or_retired_return_requires_item_note(): void
    {
        $admin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);
        [$rental] = $this->createActiveRental();

        $this->from(route('admin.returns.index'))
            ->actingAs($admin)
            ->post(route('admin.returns.store'), [
                'rental_id' => $rental->id,
                'returned_at' => '2026-04-03 20:00:00',
                'settlement_basis' => 'contract',
                'items' => [
                    [
                        'rental_item_id' => $rental->items[0]->id,
                        'next_unit_status' => InventoryUnitStatuses::MAINTENANCE,
                        'notes' => '',
                    ],
                    [
                        'rental_item_id' => $rental->items[1]->id,
                        'next_unit_status' => InventoryUnitStatuses::READY_UNCLEAN,
                        'notes' => '',
                    ],
                ],
            ])
            ->assertRedirect(route('admin.returns.index'))
            ->assertSessionHasErrors('items.0.notes');

        $this->assertDatabaseCount('returns', 0);
    }

    public function test_returned_rental_cannot_be_processed_twice(): void
    {
        $admin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);
        [$rental] = $this->createActiveRental();
        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'Cash Counter',
            'type' => 'cash',
            'code' => 'cash-counter-2',
            'active' => true,
        ]);

        $payload = [
            'rental_id' => $rental->id,
            'returned_at' => '2026-04-03 20:00:00',
            'settlement_basis' => 'actual',
            'payment_method_config_id' => $paymentMethod->id,
            'items' => $rental->items
                ->map(fn ($item) => [
                    'rental_item_id' => $item->id,
                    'next_unit_status' => InventoryUnitStatuses::READY_UNCLEAN,
                    'notes' => '',
                ])
                ->all(),
        ];

        $this->actingAs($admin)->post(route('admin.returns.store'), $payload)->assertRedirect(route('admin.returns.index'));

        $this->from(route('admin.returns.index'))
            ->actingAs($admin)
            ->post(route('admin.returns.store'), $payload)
            ->assertRedirect(route('admin.returns.index'))
            ->assertSessionHasErrors('rental_id');

        $this->assertDatabaseCount('returns', 1);
    }

    public function test_actual_settlement_basis_charges_only_until_actual_return_time(): void
    {
        $admin = $this->createUserWithRole(RoleNames::SUPER_ADMIN);
        [$rental] = $this->createActiveRental();
        $paymentMethod = PaymentMethodConfig::query()->create([
            'name' => 'Transfer BCA',
            'type' => 'transfer',
            'code' => 'bca',
            'bank_name' => 'BCA',
            'account_number' => '123456789',
            'account_name' => 'Roc Advanture',
            'active' => true,
        ]);

        $this->actingAs($admin)->post(route('admin.returns.store'), [
            'rental_id' => $rental->id,
            'returned_at' => '2026-04-01 20:00:00',
            'settlement_basis' => 'actual',
            'payment_method_config_id' => $paymentMethod->id,
            'items' => $rental->items
                ->map(fn ($item) => [
                    'rental_item_id' => $item->id,
                    'next_unit_status' => InventoryUnitStatuses::READY_UNCLEAN,
                    'notes' => '',
                ])
                ->all(),
        ])->assertRedirect(route('admin.returns.index'));

        $this->assertDatabaseHas('returns', [
            'rental_id' => $rental->id,
            'charge_basis' => 'actual',
            'final_total_days' => 1,
            'final_subtotal' => 240000,
        ]);
    }

    /**
     * @return array{0: Rental, 1: InventoryUnit, 2: InventoryUnit}
     */
    private function createActiveRental(): array
    {
        $customer = Customer::query()->create([
            'name' => 'Customer Return',
            'phone_whatsapp' => '081234567891',
        ]);

        $product = Product::query()->create([
            'name' => 'Tenda 4P',
            'category' => 'Tenda',
            'prefix_code' => 'TND4P',
            'daily_rate' => 120000,
            'active' => true,
        ]);

        $firstUnit = InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'TND4P-001',
            'status' => InventoryUnitStatuses::RENTED,
        ]);

        $secondUnit = InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'TND4P-002',
            'status' => InventoryUnitStatuses::RENTED,
        ]);

        $rental = Rental::query()->create([
            'rental_no' => 'ROC-RENT-20260401-0001',
            'customer_id' => $customer->id,
            'starts_at' => '2026-04-01 08:00:00',
            'due_at' => '2026-04-03 08:00:00',
            'total_days' => 2,
            'dp_required' => false,
            'subtotal' => 480000,
            'dp_amount' => 0,
            'paid_amount' => 0,
            'remaining_amount' => 480000,
            'payment_status' => RentalPaymentStatuses::UNPAID,
            'rental_status' => RentalStatuses::PICKED_UP,
        ]);

        $rental->items()->createMany([
            [
                'inventory_unit_id' => $firstUnit->id,
                'product_name_snapshot' => 'Tenda 4P',
                'daily_rate_snapshot' => 120000,
                'days' => 2,
                'line_total' => 240000,
                'status_at_checkout' => InventoryUnitStatuses::READY_CLEAN,
            ],
            [
                'inventory_unit_id' => $secondUnit->id,
                'product_name_snapshot' => 'Tenda 4P',
                'daily_rate_snapshot' => 120000,
                'days' => 2,
                'line_total' => 240000,
                'status_at_checkout' => InventoryUnitStatuses::READY_CLEAN,
            ],
        ]);

        return [$rental->load('items'), $firstUnit, $secondUnit];
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
