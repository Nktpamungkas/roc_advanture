<?php

namespace Tests\Feature\Admin;

use App\Http\Controllers\Admin\NotificationSettingController;
use App\Models\AppSetting;
use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\Rental;
use App\Models\User;
use App\Support\Access\RoleNames;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class NotificationSettingManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRolesAndPermissions();

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
            'services.whatsapp.rental_reminder_lead_hours' => 6,
        ]);
    }

    public function test_staff_cannot_access_notification_setting_page(): void
    {
        $staff = $this->createUserWithRole(RoleNames::STAFF);

        $this->actingAs($staff)->get(route('admin.notification-settings.index'))->assertForbidden();
    }

    public function test_admin_toko_can_open_and_update_notification_setting_page(): void
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $this->actingAs($admin)
            ->get(route('admin.notification-settings.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/notification-settings/index')
                ->where('notificationSettings.rental_reminder_enabled', true)
                ->where('notificationSettings.rental_reminder_lead_hours', 6)
                ->where('notificationSettings.overdue_reminder_enabled', false)
                ->where('notificationSettings.overdue_reminder_delay_hours', 2));

        $this->actingAs($admin)
            ->put(route('admin.notification-settings.update'), [
                'rental_reminder_enabled' => true,
                'rental_reminder_lead_hours' => 3,
                'rental_reminder_template' => 'Halo {customer_name}, batas kembali {due_at}.',
                'overdue_reminder_enabled' => true,
                'overdue_reminder_delay_hours' => 4,
                'overdue_reminder_template' => 'Rental {rental_no} sudah telat.',
            ])
            ->assertRedirect(route('admin.notification-settings.index'));

        $this->assertDatabaseHas('app_settings', [
            'key' => NotificationSettingController::RENTAL_REMINDER_ENABLED_KEY,
            'value' => '1',
        ]);

        $this->assertDatabaseHas('app_settings', [
            'key' => NotificationSettingController::RENTAL_REMINDER_LEAD_HOURS_KEY,
            'value' => '3',
        ]);

        $this->assertDatabaseHas('app_settings', [
            'key' => NotificationSettingController::RENTAL_REMINDER_TEMPLATE_KEY,
            'value' => 'Halo {customer_name}, batas kembali {due_at}.',
        ]);

        $this->assertDatabaseHas('app_settings', [
            'key' => NotificationSettingController::OVERDUE_REMINDER_ENABLED_KEY,
            'value' => '1',
        ]);

        $this->assertDatabaseHas('app_settings', [
            'key' => NotificationSettingController::OVERDUE_REMINDER_DELAY_HOURS_KEY,
            'value' => '4',
        ]);

        $this->assertDatabaseHas('app_settings', [
            'key' => NotificationSettingController::OVERDUE_REMINDER_TEMPLATE_KEY,
            'value' => 'Rental {rental_no} sudah telat.',
        ]);
    }

    public function test_whatsapp_reminder_command_uses_database_setting_when_available(): void
    {
        Http::fake([
            'https://api.fonnte.com/send' => Http::response([
                'status' => true,
                'id' => 'fonnte-reminder-setting-001',
            ], 200),
        ]);

        AppSetting::query()->create([
            'key' => NotificationSettingController::RENTAL_REMINDER_ENABLED_KEY,
            'value' => '1',
        ]);

        AppSetting::query()->create([
            'key' => NotificationSettingController::RENTAL_REMINDER_LEAD_HOURS_KEY,
            'value' => '2',
        ]);

        AppSetting::query()->create([
            'key' => NotificationSettingController::RENTAL_REMINDER_TEMPLATE_KEY,
            'value' => 'Halo {customer_name}, rental {rental_no} jatuh tempo {due_at}.',
        ]);

        $this->createActiveRental([
            'starts_at' => '2026-03-31 10:00:00',
            'due_at' => '2026-03-31 18:00:00',
        ]);

        $this->travelTo(Carbon::parse('2026-03-31 15:30:00'));

        $this->artisan('whatsapp:send-rental-reminders')->assertSuccessful();

        Http::assertNothingSent();

        $this->travelTo(Carbon::parse('2026-03-31 16:05:00'));

        $this->artisan('whatsapp:send-rental-reminders')->assertSuccessful();

        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => str_contains((string) $request['message'], 'Halo Customer Reminder, rental ROC-RENT-20260331-0001 jatuh tempo 31 Mar 2026 18:00.'));
    }

    public function test_whatsapp_reminder_command_can_send_overdue_follow_up_based_on_database_setting(): void
    {
        Http::fake([
            'https://api.fonnte.com/send' => Http::response([
                'status' => true,
                'id' => 'fonnte-overdue-reminder-001',
            ], 200),
        ]);

        AppSetting::query()->create([
            'key' => NotificationSettingController::RENTAL_REMINDER_ENABLED_KEY,
            'value' => '0',
        ]);

        AppSetting::query()->create([
            'key' => NotificationSettingController::OVERDUE_REMINDER_ENABLED_KEY,
            'value' => '1',
        ]);

        AppSetting::query()->create([
            'key' => NotificationSettingController::OVERDUE_REMINDER_DELAY_HOURS_KEY,
            'value' => '2',
        ]);

        AppSetting::query()->create([
            'key' => NotificationSettingController::OVERDUE_REMINDER_TEMPLATE_KEY,
            'value' => 'Reminder telat untuk {customer_name}. Rental {rental_no} sudah lewat {due_at}.',
        ]);

        $rental = $this->createActiveRental([
            'starts_at' => '2026-03-31 10:00:00',
            'due_at' => '2026-03-31 18:00:00',
        ]);

        $this->travelTo(Carbon::parse('2026-03-31 19:30:00'));

        $this->artisan('whatsapp:send-rental-reminders')->assertSuccessful();

        Http::assertNothingSent();

        $this->travelTo(Carbon::parse('2026-03-31 20:05:00'));

        $this->artisan('whatsapp:send-rental-reminders')->assertSuccessful();

        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => str_contains((string) $request['message'], 'Reminder telat untuk Customer Reminder. Rental ROC-RENT-20260331-0001 sudah lewat 31 Mar 2026 18:00.'));

        $this->assertDatabaseHas('wa_logs', [
            'rental_id' => $rental->id,
            'message_type' => 'rental_overdue_reminder',
            'status' => 'sent',
            'provider_message_id' => 'fonnte-overdue-reminder-001',
        ]);
    }

    /**
     * @param  array<string, mixed>  $rentalOverrides
     */
    private function createActiveRental(array $rentalOverrides = []): Rental
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);

        $customer = Customer::query()->create([
            'name' => 'Customer Reminder',
            'phone_whatsapp' => '081234567890',
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
            'status' => InventoryUnitStatuses::RENTED,
        ]);

        $rental = Rental::query()->create(array_merge([
            'rental_no' => 'ROC-RENT-20260331-0001',
            'customer_id' => $customer->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-03-31 10:00:00',
            'due_at' => '2026-03-31 18:00:00',
            'total_days' => 1,
            'dp_required' => false,
            'subtotal' => 50000,
            'dp_amount' => 0,
            'paid_amount' => 0,
            'remaining_amount' => 50000,
            'payment_status' => RentalPaymentStatuses::UNPAID,
            'rental_status' => RentalStatuses::PICKED_UP,
        ], $rentalOverrides));

        $rental->items()->create([
            'inventory_unit_id' => $unit->id,
            'product_name_snapshot' => 'Carrier 40L',
            'daily_rate_snapshot' => 50000,
            'days' => 1,
            'line_total' => 50000,
            'status_at_checkout' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        return $rental;
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
