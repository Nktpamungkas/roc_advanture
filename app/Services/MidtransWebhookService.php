<?php

namespace App\Services;

use App\Models\CombinedOrder;
use App\Models\MidtransWebhookLog;
use App\Models\Payment;
use App\Models\Rental;
use App\Support\Rental\PaymentKinds;
use App\Support\Rental\RentalPaymentStatuses;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class MidtransWebhookService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function handle(array $payload): array
    {
        $normalized = $this->normalizePayload($payload);
        $signatureValid = $this->signatureIsValid($normalized);

        return DB::transaction(function () use ($normalized, $signatureValid): array {
            $log = MidtransWebhookLog::query()
                ->where('transaction_id', $normalized['transaction_id'])
                ->lockForUpdate()
                ->first();

            if ($log?->processed_at !== null) {
                return [
                    'processed' => true,
                    'signature_valid' => (bool) $log->signature_valid,
                    'message' => 'Webhook already processed.',
                    'target_type' => $log->target_type,
                    'target_key' => $log->target_key,
                ];
            }

            $log ??= new MidtransWebhookLog();
            $log->fill([
                'provider' => 'midtrans',
                'order_id' => $normalized['order_id'],
                'transaction_id' => $normalized['transaction_id'],
                'transaction_status' => $normalized['transaction_status'],
                'status_code' => $normalized['status_code'],
                'fraud_status' => $normalized['fraud_status'],
                'payment_type' => $normalized['payment_type'],
                'gross_amount' => $normalized['gross_amount'],
                'currency' => $normalized['currency'],
                'signature_valid' => $signatureValid,
                'payload' => $normalized['payload'],
            ]);

            if (! $signatureValid) {
                $log->fill([
                    'target_type' => 'unknown',
                    'target_key' => $normalized['order_id'],
                    'notes' => 'Invalid Midtrans signature.',
                    'processed_at' => now(),
                ])->save();

                return [
                    'processed' => false,
                    'signature_valid' => false,
                    'message' => 'Invalid signature.',
                ];
            }

            if (! $this->isSuccessful($normalized)) {
                $log->fill([
                    'target_type' => 'ignored',
                    'target_key' => $normalized['order_id'],
                    'notes' => sprintf(
                        'Ignored Midtrans status "%s".',
                        $normalized['transaction_status'] ?: 'unknown'
                    ),
                    'processed_at' => now(),
                ])->save();

                return [
                    'processed' => false,
                    'signature_valid' => true,
                    'message' => 'Notification acknowledged but no state change was applied.',
                    'transaction_status' => $normalized['transaction_status'],
                ];
            }

            if ($rental = Rental::query()->where('rental_no', $normalized['order_id'])->lockForUpdate()->first()) {
                $result = $this->applyToRental($rental, $normalized);

                $log->fill([
                    'target_type' => 'rental',
                    'target_key' => $rental->rental_no,
                    'notes' => $result['notes'],
                    'processed_at' => now(),
                ])->save();

                return [
                    'processed' => true,
                    'signature_valid' => true,
                    'message' => $result['notes'],
                    'target_type' => 'rental',
                    'target_key' => $rental->rental_no,
                ];
            }

            if ($combinedOrder = CombinedOrder::query()->where('combined_no', $normalized['order_id'])->lockForUpdate()->first()) {
                $result = $this->applyToCombinedOrder($combinedOrder, $normalized);

                $log->fill([
                    'target_type' => 'combined_order',
                    'target_key' => $combinedOrder->combined_no,
                    'notes' => $result['notes'],
                    'processed_at' => now(),
                ])->save();

                return [
                    'processed' => true,
                    'signature_valid' => true,
                    'message' => $result['notes'],
                    'target_type' => 'combined_order',
                    'target_key' => $combinedOrder->combined_no,
                ];
            }

            $log->fill([
                'target_type' => 'unknown',
                'target_key' => $normalized['order_id'],
                'notes' => sprintf('No matching invoice found for order ID "%s".', $normalized['order_id']),
                'processed_at' => now(),
            ])->save();

            return [
                'processed' => false,
                'signature_valid' => true,
                'message' => 'No matching invoice found.',
                'target_type' => 'unknown',
                'target_key' => $normalized['order_id'],
            ];
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normalizePayload(array $payload): array
    {
        $orderId = trim((string) ($payload['order_id'] ?? ''));
        $transactionId = trim((string) ($payload['transaction_id'] ?? ''));
        $statusCode = trim((string) ($payload['status_code'] ?? ''));
        $grossAmount = (string) ($payload['gross_amount'] ?? '');

        if ($orderId === '' || $transactionId === '' || $statusCode === '' || $grossAmount === '') {
            throw new RuntimeException('Payload Midtrans tidak lengkap.');
        }

        return [
            'payload' => $payload,
            'order_id' => $orderId,
            'transaction_id' => $transactionId,
            'transaction_status' => trim((string) ($payload['transaction_status'] ?? '')),
            'status_code' => $statusCode,
            'fraud_status' => trim((string) ($payload['fraud_status'] ?? '')),
            'payment_type' => trim((string) ($payload['payment_type'] ?? '')),
            'gross_amount' => round((float) $grossAmount, 2),
            'gross_amount_signature' => $grossAmount,
            'currency' => trim((string) ($payload['currency'] ?? 'IDR')),
        ];
    }

    /**
     * @param  array<string, mixed>  $normalized
     */
    private function signatureIsValid(array $normalized): bool
    {
        $serverKey = (string) config('services.midtrans.server_key');

        if ($serverKey === '') {
            return false;
        }

        $expectedSignature = hash(
            'sha512',
            $normalized['order_id'].$normalized['status_code'].$normalized['gross_amount_signature'].$serverKey
        );

        $providedSignature = (string) ($normalized['payload']['signature_key'] ?? '');

        return $providedSignature !== '' && hash_equals($expectedSignature, $providedSignature);
    }

    /**
     * @param  array<string, mixed>  $normalized
     */
    private function isSuccessful(array $normalized): bool
    {
        return $normalized['transaction_status'] === 'settlement'
            || (
                $normalized['transaction_status'] === 'capture'
                && $normalized['fraud_status'] === 'accept'
            );
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @return array<string, mixed>
     */
    private function applyToRental(Rental $rental, array $normalized): array
    {
        $paidAmount = round((float) $rental->paid_amount + (float) $normalized['gross_amount'], 2);
        $subtotal = round((float) $rental->subtotal, 2);
        $remainingAmount = round(max(0, $subtotal - $paidAmount), 2);
        $paymentStatus = $paidAmount >= $subtotal
            ? RentalPaymentStatuses::PAID
            : RentalPaymentStatuses::DP_PAID;

        $rental->fill([
            'paid_amount' => $paidAmount,
            'remaining_amount' => $remainingAmount,
            'payment_status' => $paymentStatus,
        ])->save();

        if (! Payment::query()->where('gateway_transaction_id', $normalized['transaction_id'])->exists()) {
            Payment::query()->create([
                'rental_id' => $rental->id,
                'received_by' => null,
                'payment_method_config_id' => $rental->payment_method_config_id,
                'payment_kind' => $paymentStatus === RentalPaymentStatuses::PAID
                    ? PaymentKinds::SETTLEMENT
                    : PaymentKinds::DP,
                'amount' => (float) $normalized['gross_amount'],
                'paid_at' => $this->resolvePaidAt($normalized['payload']),
                'method' => $normalized['payment_type'] !== '' ? $normalized['payment_type'] : 'midtrans',
                'method_label_snapshot' => $this->resolveMethodLabel($normalized['payment_type']),
                'method_type_snapshot' => $normalized['payment_type'] !== '' ? $normalized['payment_type'] : 'midtrans',
                'instructions_snapshot' => null,
                'gateway_provider' => 'midtrans',
                'gateway_transaction_id' => $normalized['transaction_id'],
                'gateway_order_id' => $normalized['order_id'],
                'gateway_status' => $normalized['transaction_status'],
                'gateway_fraud_status' => $normalized['fraud_status'] ?: null,
                'notes' => 'Midtrans tx: '.$normalized['transaction_id'],
            ]);
        }

        return [
            'notes' => sprintf(
                'Rental %s diperbarui dari Midtrans (%s).',
                $rental->rental_no,
                $normalized['transaction_status']
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @return array<string, mixed>
     */
    private function applyToCombinedOrder(CombinedOrder $combinedOrder, array $normalized): array
    {
        $paidAmount = round((float) $combinedOrder->paid_amount + (float) $normalized['gross_amount'], 2);
        $subtotal = round((float) $combinedOrder->subtotal, 2);
        $remainingAmount = round(max(0, $subtotal - $paidAmount), 2);

        $combinedOrder->fill([
            'paid_amount' => $paidAmount,
            'remaining_amount' => $remainingAmount,
            'payment_status' => $paidAmount >= $subtotal ? 'paid' : 'partial',
        ])->save();

        return [
            'notes' => sprintf(
                'Transaksi gabungan %s diperbarui dari Midtrans (%s).',
                $combinedOrder->combined_no,
                $normalized['transaction_status']
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function resolvePaidAt(array $payload): CarbonInterface
    {
        $transactionTime = (string) ($payload['transaction_time'] ?? '');

        if ($transactionTime === '') {
            return now();
        }

        try {
            return Carbon::parse($transactionTime);
        } catch (\Throwable $exception) {
            return now();
        }
    }

    private function resolveMethodLabel(string $paymentType): string
    {
        return match ($paymentType) {
            'qris' => 'Midtrans QRIS',
            'bank_transfer' => 'Midtrans Transfer Bank',
            'echannel' => 'Midtrans E-Channel',
            'gopay' => 'Midtrans GoPay',
            default => $paymentType !== '' ? 'Midtrans '.strtoupper(str_replace('_', ' ', $paymentType)) : 'Midtrans',
        };
    }
}
