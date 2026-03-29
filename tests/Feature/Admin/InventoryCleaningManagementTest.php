<?php

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\User;
use App\Support\Access\RoleNames;
use App\Support\Rental\InventoryUnitStatuses;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class InventoryCleaningManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_washing_page(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.washing.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_washing_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $product = Product::query()->create([
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'prefix_code' => 'CAR50',
            'daily_rate' => 75000,
            'active' => true,
        ]);

        $product->inventoryUnits()->create([
            'unit_code' => 'CAR50-001',
            'status' => InventoryUnitStatuses::READY_UNCLEAN,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.washing.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/washing/index')
                ->where('washingSummary.total_dirty_units', 1)
                ->has('dirtyUnits', 1)
                ->where('dirtyUnits.0.unit_code', 'CAR50-001'));
    }

    public function test_admin_toko_can_mark_selected_dirty_units_as_clean(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $product = Product::query()->create([
            'name' => 'Tenda 4P',
            'category' => 'Tenda',
            'prefix_code' => 'TND4P',
            'daily_rate' => 120000,
            'active' => true,
        ]);

        $dirtyA = $product->inventoryUnits()->create([
            'unit_code' => 'TND4P-001',
            'status' => InventoryUnitStatuses::READY_UNCLEAN,
        ]);

        $dirtyB = $product->inventoryUnits()->create([
            'unit_code' => 'TND4P-002',
            'status' => InventoryUnitStatuses::READY_UNCLEAN,
        ]);

        $stillDirty = $product->inventoryUnits()->create([
            'unit_code' => 'TND4P-003',
            'status' => InventoryUnitStatuses::READY_UNCLEAN,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.washing.store'), [
                'unit_ids' => [$dirtyA->id, $dirtyB->id],
            ])
            ->assertRedirect(route('admin.washing.index'));

        $this->assertDatabaseHas('inventory_units', [
            'id' => $dirtyA->id,
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);
        $this->assertDatabaseHas('inventory_units', [
            'id' => $dirtyB->id,
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);
        $this->assertDatabaseHas('inventory_units', [
            'id' => $stillDirty->id,
            'status' => InventoryUnitStatuses::READY_UNCLEAN,
        ]);
    }

    public function test_only_ready_unclean_units_can_be_processed_in_washing_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $product = Product::query()->create([
            'name' => 'Flysheet 3x4',
            'category' => 'Flysheet',
            'prefix_code' => 'FLS34',
            'daily_rate' => 15000,
            'active' => true,
        ]);

        $cleanUnit = $product->inventoryUnits()->create([
            'unit_code' => 'FLS34-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $this->from(route('admin.washing.index'))
            ->actingAs($admin)
            ->post(route('admin.washing.store'), [
                'unit_ids' => [$cleanUnit->id],
            ])
            ->assertRedirect(route('admin.washing.index'))
            ->assertSessionHasErrors('unit_ids');

        $this->assertDatabaseHas('inventory_units', [
            'id' => $cleanUnit->id,
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
