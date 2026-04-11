<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\Rental;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MidtransWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.midtrans.server_key' => 'midtrans-secret',
        ]);
    }

    public function test_midtrans_webhook_updates_rental_and_records_payment(): void
    {
        $rental = $this->createRental();

        $payload = $this->buildPayload(
            orderId: $rental->rental_no,
            transactionId: 'midtrans-tx-001',
            grossAmount: '120000.00',
        );

        $this->postJson(route('payment.webhook.midtrans'), $payload)
            ->assertOk()
            ->assertJson([
                'received' => true,
                'processed' => true,
                'target_type' => 'rental',
                'target_key' => $rental->rental_no,
            ]);

        $this->assertDatabaseHas('midtrans_webhook_logs', [
            'provider' => 'midtrans',
            'order_id' => $rental->rental_no,
            'transaction_id' => 'midtrans-tx-001',
            'transaction_status' => 'settlement',
            'signature_valid' => 1,
            'target_type' => 'rental',
            'target_key' => $rental->rental_no,
        ]);

        $this->assertDatabaseHas('rentals', [
            'id' => $rental->id,
            'payment_status' => RentalPaymentStatuses::PAID,
            'paid_amount' => '120000.00',
            'remaining_amount' => '0.00',
        ]);

        $this->assertDatabaseHas('payments', [
            'rental_id' => $rental->id,
            'gateway_provider' => 'midtrans',
            'gateway_transaction_id' => 'midtrans-tx-001',
            'gateway_order_id' => $rental->rental_no,
            'gateway_status' => 'settlement',
            'gateway_fraud_status' => 'accept',
            'payment_kind' => 'settlement',
            'amount' => '120000.00',
        ]);
    }

    public function test_midtrans_webhook_rejects_invalid_signature_without_changing_rental(): void
    {
        $rental = $this->createRental();

        $payload = $this->buildPayload(
            orderId: $rental->rental_no,
            transactionId: 'midtrans-tx-002',
            grossAmount: '120000.00',
            signatureKey: 'invalid-signature',
        );

        $this->postJson(route('payment.webhook.midtrans'), $payload)
            ->assertOk()
            ->assertJson([
                'received' => true,
                'processed' => false,
            ]);

        $this->assertDatabaseHas('midtrans_webhook_logs', [
            'provider' => 'midtrans',
            'order_id' => $rental->rental_no,
            'transaction_id' => 'midtrans-tx-002',
            'signature_valid' => 0,
            'target_type' => 'unknown',
        ]);

        $this->assertDatabaseHas('rentals', [
            'id' => $rental->id,
            'payment_status' => RentalPaymentStatuses::UNPAID,
            'paid_amount' => '0.00',
            'remaining_amount' => '120000.00',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildPayload(
        string $orderId,
        string $transactionId,
        string $grossAmount,
        string $transactionStatus = 'settlement',
        string $fraudStatus = 'accept',
        ?string $signatureKey = null,
    ): array {
        $statusCode = '200';
        $signatureKey ??= hash('sha512', $orderId.$statusCode.$grossAmount.'midtrans-secret');

        return [
            'transaction_time' => '2026-04-11 10:15:00',
            'transaction_status' => $transactionStatus,
            'transaction_id' => $transactionId,
            'status_message' => 'settlement',
            'status_code' => $statusCode,
            'signature_key' => $signatureKey,
            'payment_type' => 'qris',
            'order_id' => $orderId,
            'gross_amount' => $grossAmount,
            'currency' => 'IDR',
            'fraud_status' => $fraudStatus,
        ];
    }

    private function createRental(): Rental
    {
        $customer = Customer::query()->create([
            'name' => 'Customer Midtrans',
            'phone_whatsapp' => '081200000001',
            'address' => 'Alamat Test',
        ]);

        $product = Product::query()->create([
            'name' => 'Carrier 50L',
            'category' => 'Carrier',
            'prefix_code' => 'CAR50',
            'daily_rate' => 120000,
            'active' => true,
        ]);

        $unit = InventoryUnit::query()->create([
            'product_id' => $product->id,
            'unit_code' => 'CAR50-001',
            'status' => InventoryUnitStatuses::READY_CLEAN,
        ]);

        $rental = Rental::query()->create([
            'rental_no' => 'ROC-RENT-20260411-0001',
            'customer_id' => $customer->id,
            'starts_at' => Carbon::parse('2026-04-11 08:00:00'),
            'due_at' => Carbon::parse('2026-04-12 08:00:00'),
            'total_days' => 1,
            'dp_required' => false,
            'subtotal' => 120000,
            'dp_amount' => 0,
            'paid_amount' => 0,
            'remaining_amount' => 120000,
            'payment_status' => RentalPaymentStatuses::UNPAID,
            'rental_status' => RentalStatuses::PICKED_UP,
            'notes' => null,
        ]);

        $rental->items()->create([
            'inventory_unit_id' => $unit->id,
            'product_name_snapshot' => 'Carrier 50L',
            'daily_rate_snapshot' => 120000,
            'days' => 1,
            'line_total' => 120000,
            'status_at_checkout' => InventoryUnitStatuses::READY_CLEAN,
            'notes' => null,
        ]);

        return $rental;
    }
}
