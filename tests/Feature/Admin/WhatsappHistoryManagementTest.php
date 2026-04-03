<?php

namespace Tests\Feature\Admin;

use App\Models\Customer;
use App\Models\Rental;
use App\Models\User;
use App\Models\WaLog;
use App\Support\Access\RoleNames;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WhatsappHistoryManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();
    }

    public function test_staff_cannot_access_whatsapp_history_page(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.whatsapp-history.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_whatsapp_history_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.whatsapp-history.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/whatsapp-history/index'));
    }

    public function test_admin_toko_can_delete_whatsapp_history_log(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $rental = $this->createRental($admin);

        $log = WaLog::query()->create([
            'rental_id' => $rental->id,
            'phone' => '6281234567890',
            'message_type' => 'rental_due_reminder',
            'scheduled_at' => '2026-03-30 10:00:00',
            'status' => 'sent',
        ]);

        $this->actingAs($admin)
            ->from(route('admin.whatsapp-history.index', ['tab' => 'reminders']))
            ->delete(route('admin.whatsapp-history.destroy', $log))
            ->assertRedirect(route('admin.whatsapp-history.index', ['tab' => 'reminders']));

        $this->assertDatabaseMissing('wa_logs', [
            'id' => $log->id,
        ]);
    }

    public function test_admin_toko_can_delete_selected_whatsapp_history_logs(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $rental = $this->createRental($admin);

        $selectedLog = WaLog::query()->create([
            'rental_id' => $rental->id,
            'phone' => '6281234567890',
            'message_type' => 'rental_due_reminder',
            'scheduled_at' => '2026-03-30 10:00:00',
            'status' => 'sent',
        ]);

        $untouchedLog = WaLog::query()->create([
            'rental_id' => $rental->id,
            'phone' => '6281234567891',
            'message_type' => 'rental_due_reminder',
            'scheduled_at' => '2026-03-30 11:00:00',
            'status' => 'pending',
        ]);

        $this->actingAs($admin)
            ->from(route('admin.whatsapp-history.index', ['tab' => 'reminders']))
            ->delete(route('admin.whatsapp-history.destroy-selected'), [
                'tab' => 'reminders',
                'ids' => [$selectedLog->id],
            ])
            ->assertRedirect(route('admin.whatsapp-history.index', ['tab' => 'reminders']));

        $this->assertDatabaseMissing('wa_logs', [
            'id' => $selectedLog->id,
        ]);

        $this->assertDatabaseHas('wa_logs', [
            'id' => $untouchedLog->id,
        ]);
    }

    public function test_admin_toko_can_delete_all_whatsapp_history_in_active_tab(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $rental = $this->createRental($admin);

        WaLog::query()->create([
            'rental_id' => $rental->id,
            'phone' => '6281234567890',
            'message_type' => 'rental_invoice_manual',
            'scheduled_at' => '2026-03-30 10:00:00',
            'status' => 'sent',
        ]);

        WaLog::query()->create([
            'rental_id' => $rental->id,
            'phone' => '6281234567891',
            'message_type' => 'rental_invoice_document',
            'scheduled_at' => '2026-03-30 11:00:00',
            'status' => 'failed',
        ]);

        $reminderLog = WaLog::query()->create([
            'rental_id' => $rental->id,
            'phone' => '6281234567892',
            'message_type' => 'rental_due_reminder',
            'scheduled_at' => '2026-03-30 12:00:00',
            'status' => 'sent',
        ]);

        $this->actingAs($admin)
            ->from(route('admin.whatsapp-history.index', ['tab' => 'invoices']))
            ->delete(route('admin.whatsapp-history.destroy-all'), [
                'tab' => 'invoices',
            ])
            ->assertRedirect(route('admin.whatsapp-history.index', ['tab' => 'invoices']));

        $this->assertSame(0, WaLog::query()->where('message_type', 'like', 'rental_invoice%')->count());
        $this->assertDatabaseHas('wa_logs', [
            'id' => $reminderLog->id,
        ]);
    }

    public function test_staff_cannot_delete_whatsapp_history_log(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $rental = $this->createRental($admin);

        $log = WaLog::query()->create([
            'rental_id' => $rental->id,
            'phone' => '6281234567890',
            'message_type' => 'rental_due_reminder',
            'scheduled_at' => '2026-03-30 10:00:00',
            'status' => 'sent',
        ]);

        $this->actingAs($staff)
            ->delete(route('admin.whatsapp-history.destroy', $log))
            ->assertForbidden();

        $this->assertDatabaseHas('wa_logs', [
            'id' => $log->id,
        ]);
    }

    public function test_whatsapp_history_page_separates_reminder_and_invoice_logs_with_independent_filters(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $reminderRental = $this->createRental($admin, [
            'rental_no' => 'ROC-RENT-20260330-0001',
        ], [
            'name' => 'Akim',
            'phone_whatsapp' => '081111111111',
        ]);

        $invoiceRental = $this->createRental($admin, [
            'rental_no' => 'ROC-RENT-20260330-0002',
        ], [
            'name' => 'Nilo',
            'phone_whatsapp' => '082222222222',
        ]);

        WaLog::query()->create([
            'rental_id' => $reminderRental->id,
            'phone' => '628111111111',
            'message_type' => 'rental_due_reminder',
            'scheduled_at' => '2026-03-30 10:00:00',
            'sent_at' => '2026-03-30 10:05:00',
            'status' => 'sent',
            'provider_message_id' => 'fonnte-reminder-001',
        ]);

        WaLog::query()->create([
            'rental_id' => $invoiceRental->id,
            'phone' => '628222222222',
            'message_type' => 'rental_invoice_manual',
            'scheduled_at' => '2026-03-30 11:00:00',
            'sent_at' => '2026-03-30 11:03:00',
            'status' => 'sent',
            'provider_message_id' => 'fonnte-invoice-001',
        ]);

        WaLog::query()->create([
            'rental_id' => $invoiceRental->id,
            'phone' => '628222222222',
            'message_type' => 'rental_invoice_document',
            'scheduled_at' => '2026-03-30 11:10:00',
            'status' => 'failed',
            'provider_message_id' => 'fonnte-invoice-002',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.whatsapp-history.index', [
                'tab' => 'invoices',
                'invoice_search' => 'ROC-RENT-20260330-0002',
                'invoice_status' => 'all',
                'invoice_per_page' => 10,
                'reminder_search' => 'Akim',
                'reminder_status' => 'sent',
                'reminder_per_page' => 10,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/whatsapp-history/index')
                ->where('activeTab', 'invoices')
                ->where('reminderFilters.search', 'Akim')
                ->where('reminderFilters.status', 'sent')
                ->where('invoiceFilters.search', 'ROC-RENT-20260330-0002')
                ->where('invoiceSummary.total', 2)
                ->where('invoiceSummary.sent', 1)
                ->where('invoiceSummary.failed', 1)
                ->where('reminderSummary.total', 1)
                ->has('reminders', 1)
                ->where('reminders.0.rental_no', 'ROC-RENT-20260330-0001')
                ->has('invoices', 2)
                ->where('invoices.0.rental_no', 'ROC-RENT-20260330-0002'));
    }

    public function test_whatsapp_history_page_labels_extension_invoice_logs(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $rental = $this->createRental($admin, [
            'rental_no' => 'ROC-RENT-20260403-0011',
        ], [
            'name' => 'Dika',
            'phone_whatsapp' => '081300000000',
        ]);

        WaLog::query()->create([
            'rental_id' => $rental->id,
            'phone' => '6281300000000',
            'message_type' => 'rental_extension_invoice_manual',
            'scheduled_at' => '2026-04-03 20:45:00',
            'sent_at' => '2026-04-03 20:45:10',
            'status' => 'sent',
            'provider_message_id' => 'fonnte-extension-009',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.whatsapp-history.index', [
                'tab' => 'invoices',
                'invoice_search' => 'ROC-RENT-20260403-0011',
                'invoice_status' => 'all',
                'invoice_per_page' => 10,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/whatsapp-history/index')
                ->where('invoiceSummary.total', 1)
                ->has('invoices', 1)
                ->where('invoices.0.message_type', 'rental_extension_invoice_manual')
                ->where('invoices.0.message_type_label', 'Invoice Perpanjangan via WhatsApp'));
    }

    private function createRental(User $admin, array $rentalAttributes = [], array $customerAttributes = []): Rental
    {
        $customer = Customer::query()->create(array_merge([
            'name' => 'Customer Test',
            'phone_whatsapp' => '081234567890',
            'address' => 'Cikupa',
        ], $customerAttributes));

        return Rental::query()->create(array_merge([
            'rental_no' => 'ROC-RENT-20260330-0099',
            'customer_id' => $customer->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-03-30 08:00:00',
            'due_at' => '2026-03-31 08:00:00',
            'total_days' => 1,
            'subtotal' => 50000,
            'dp_amount' => 0,
            'paid_amount' => 0,
            'remaining_amount' => 50000,
            'payment_status' => 'unpaid',
            'rental_status' => 'booked',
        ], $rentalAttributes));
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
