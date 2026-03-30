<?php

namespace Tests\Feature\Admin;

use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\Rental;
use App\Models\User;
use App\Models\WaLog;
use App\Services\RentalInvoicePdfService;
use App\Support\Access\RoleNames;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Mockery\MockInterface;
use Tests\TestCase;

class WhatsappReminderManagementTest extends TestCase
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
            'services.whatsapp.field_file' => 'file',
            'services.whatsapp.field_token' => 'token',
            'services.whatsapp.rental_reminder_lead_hours' => 6,
        ]);
    }

    public function test_admin_can_send_rental_invoice_via_whatsapp(): void
    {
        Http::fake([
            'https://api.fonnte.com/send' => Http::response([
                'status' => true,
                'id' => 'fonnte-invoice-001',
            ], 200),
        ]);

        [$admin, $rental] = $this->createActiveRental();

        $this->mock(RentalInvoicePdfService::class, function (MockInterface $mock) use ($rental): void {
            $mock->shouldReceive('filename')
                ->once()
                ->withArgs(fn (Rental $invoiceRental) => $invoiceRental->is($rental))
                ->andReturn('invoice-sewa-roc-rent-20260310-0001.pdf');

            $mock->shouldReceive('render')
                ->once()
                ->withArgs(fn (Rental $invoiceRental) => $invoiceRental->is($rental))
                ->andReturn('%PDF-1.7 fake invoice pdf');
        });

        $response = $this->actingAs($admin)->post(route('admin.rentals.send-invoice-whatsapp', $rental));

        $response->assertRedirect(route('admin.rentals.show', $rental));
        $response->assertSessionHas('success', 'Invoice berhasil dikirim ke WhatsApp customer.');

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.fonnte.com/send'
                && $request->hasHeader('Authorization', 'testing-token')
                && $request->isMultipart()
                && str_contains($request->body(), '6281234567890')
                && str_contains($request->body(), 'Invoice Sewa Roc Advanture')
                && $request->hasFile('file', filename: 'invoice-sewa-roc-rent-20260310-0001.pdf');
        });

        $this->assertDatabaseHas('wa_logs', [
            'rental_id' => $rental->id,
            'phone' => '6281234567890',
            'message_type' => 'rental_invoice_manual',
            'status' => 'sent',
            'provider_message_id' => 'fonnte-invoice-001',
        ]);
    }

    public function test_admin_can_send_rental_invoice_when_provider_returns_array_message_id(): void
    {
        Http::fake([
            'https://api.fonnte.com/send' => Http::response([
                'status' => true,
                'id' => ['fonnte-array-001'],
            ], 200),
        ]);

        [$admin, $rental] = $this->createActiveRental([
            'rental_no' => 'ROC-RENT-20260310-0005',
        ]);

        $this->mock(RentalInvoicePdfService::class, function (MockInterface $mock) use ($rental): void {
            $mock->shouldReceive('filename')
                ->once()
                ->withArgs(fn (Rental $invoiceRental) => $invoiceRental->is($rental))
                ->andReturn('invoice-sewa-roc-rent-20260310-0005.pdf');

            $mock->shouldReceive('render')
                ->once()
                ->withArgs(fn (Rental $invoiceRental) => $invoiceRental->is($rental))
                ->andReturn('%PDF-1.7 fake invoice pdf');
        });

        $response = $this->actingAs($admin)->post(route('admin.rentals.send-invoice-whatsapp', $rental));

        $response->assertRedirect(route('admin.rentals.show', $rental));
        $response->assertSessionHas('success', 'Invoice berhasil dikirim ke WhatsApp customer.');

        $this->assertDatabaseHas('wa_logs', [
            'rental_id' => $rental->id,
            'message_type' => 'rental_invoice_manual',
            'status' => 'sent',
            'provider_message_id' => 'fonnte-array-001',
        ]);
    }

    public function test_reminder_command_sends_due_rental_whatsapp_once(): void
    {
        Http::fake([
            'https://api.fonnte.com/send' => Http::response([
                'status' => true,
                'id' => 'fonnte-reminder-001',
            ], 200),
        ]);

        [$admin, $rental] = $this->createActiveRental([
            'rental_no' => 'ROC-RENT-20260310-0009',
            'starts_at' => '2026-03-10 10:00:00',
            'due_at' => '2026-03-10 18:00:00',
        ]);

        $this->travelTo(Carbon::parse('2026-03-10 12:05:00'));

        $this->artisan('whatsapp:send-rental-reminders')
            ->assertSuccessful();

        Http::assertSentCount(1);
        Http::assertSent(function ($request) {
            return $request['target'] === '6281234567890'
                && str_contains((string) $request['message'], 'pengingat pengembalian');
        });

        $this->assertDatabaseHas('wa_logs', [
            'rental_id' => $rental->id,
            'message_type' => 'rental_due_reminder',
            'status' => 'sent',
            'provider_message_id' => 'fonnte-reminder-001',
        ]);

        $this->artisan('whatsapp:send-rental-reminders')
            ->assertSuccessful();

        Http::assertSentCount(1);
        $this->assertSame(1, WaLog::query()->where('rental_id', $rental->id)->where('message_type', 'rental_due_reminder')->count());
    }

    /**
     * @param  array<string, mixed>  $rentalOverrides
     * @return array{0: User, 1: Rental}
     */
    private function createActiveRental(array $rentalOverrides = []): array
    {
        $admin = $this->createUserWithRole(RoleNames::ADMIN_TOKO);
        $customer = Customer::query()->create([
            'name' => 'Nilo',
            'phone_whatsapp' => '081234567890',
            'address' => 'Mega Lestart Blok C2 No. 1',
        ]);

        $product = Product::query()->create([
            'name' => 'Tenda 4P',
            'category' => 'Tenda',
            'daily_rate' => 50000,
            'active' => true,
        ]);

        $inventoryUnit = InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'TND4P-001',
            'status' => InventoryUnitStatuses::RENTED,
        ]);

        $rental = Rental::query()->create(array_merge([
            'rental_no' => 'ROC-RENT-20260310-0001',
            'customer_id' => $customer->id,
            'created_by' => $admin->id,
            'starts_at' => '2026-03-10 08:00:00',
            'due_at' => '2026-03-10 18:00:00',
            'total_days' => 1,
            'dp_required' => false,
            'subtotal' => 50000,
            'dp_amount' => 0,
            'paid_amount' => 25000,
            'remaining_amount' => 25000,
            'payment_status' => RentalPaymentStatuses::DP_PAID,
            'rental_status' => RentalStatuses::PICKED_UP,
        ], $rentalOverrides));

        $rental->items()->create([
            'inventory_unit_id' => $inventoryUnit->id,
            'product_name_snapshot' => 'Tenda 4P',
            'daily_rate_snapshot' => 50000,
            'days' => 1,
            'line_total' => 50000,
            'status_at_checkout' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        return [$admin, $rental];
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->assignRole($role);

        return $user;
    }
}
