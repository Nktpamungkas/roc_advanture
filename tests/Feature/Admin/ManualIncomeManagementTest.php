<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Support\Access\RoleNames;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ManualIncomeManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_manual_income_page(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.manual-incomes.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_manual_income_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.manual-incomes.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/manual-incomes/index'));
    }

    public function test_admin_toko_can_record_manual_income_and_financial_report_reads_it(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)->post(route('admin.manual-incomes.store'), [
            'recorded_at' => '2026-04-11 13:30:00',
            'category' => 'rental_non_master',
            'title' => 'Sewa headlamp pribadi',
            'amount' => 50000,
            'notes' => 'Barang pribadi pemilik, tidak masuk master rental.',
        ])->assertRedirect(route('admin.manual-incomes.index'));

        $this->assertDatabaseHas('manual_incomes', [
            'category' => 'rental_non_master',
            'title' => 'Sewa headlamp pribadi',
            'amount' => 50000,
            'recorded_by' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.financial-reports.index', [
                'date_from' => '2026-04-11',
                'date_to' => '2026-04-11',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/reports/combined/index')
                ->where('reportSummary.manual_income_total', 1)
                ->where('reportSummary.grand_total_amount', 50000)
                ->has('transactions', 1)
                ->where('transactions.0.source_type', 'manual_income')
                ->where('transactions.0.reference_no', 'ROC-MAN-20260411-0001')
                ->where('transactions.0.total_amount', '50000.00'));
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
