<?php

namespace App\Services;

use App\Models\Rental;
use App\Models\WaLog;
use App\Support\Rental\RentalStatuses;
use Carbon\CarbonInterface;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use RuntimeException;

class WhatsappService
{
    public function __construct(
        private readonly HttpFactory $http,
    ) {
    }

    public function sendRentalInvoice(Rental $rental): WaLog
    {
        $rental->loadMissing(['customer', 'creator', 'items.inventoryUnit']);

        $phone = $this->resolveRentalPhone($rental);
        $message = $this->buildRentalInvoiceMessage($rental);

        return $this->dispatchMessage(
            rental: $rental,
            phone: $phone,
            messageType: 'rental_invoice_manual',
            message: $message,
            scheduledAt: now(),
        );
    }

    public function sendDueRentalReminders(): int
    {
        if (! $this->isEnabled()) {
            return 0;
        }

        $leadHours = max(1, (int) config('services.whatsapp.rental_reminder_lead_hours', 6));
        $now = now();

        $rentals = Rental::query()
            ->with(['customer', 'items.inventoryUnit'])
            ->whereIn('rental_status', [
                RentalStatuses::BOOKED,
                RentalStatuses::PICKED_UP,
                RentalStatuses::LATE,
            ])
            ->whereNotNull('due_at')
            ->whereNotNull('customer_id')
            ->whereHas('customer', fn ($query) => $query->whereNotNull('phone_whatsapp')->where('phone_whatsapp', '!=', ''))
            ->get()
            ->filter(function (Rental $rental) use ($leadHours, $now): bool {
                $triggerAt = $rental->due_at?->copy()->subHours($leadHours);

                return $triggerAt !== null
                    && $now->greaterThanOrEqualTo($triggerAt)
                    && $now->lessThanOrEqualTo($rental->due_at);
            })
            ->values();

        $sentCount = 0;

        foreach ($rentals as $rental) {
            $alreadySent = WaLog::query()
                ->where('rental_id', $rental->id)
                ->where('message_type', 'rental_due_reminder')
                ->whereIn('status', ['pending', 'sent'])
                ->exists();

            if ($alreadySent) {
                continue;
            }

            $phone = $this->resolveRentalPhone($rental);
            $message = $this->buildRentalReminderMessage($rental);

            $this->dispatchMessage(
                rental: $rental,
                phone: $phone,
                messageType: 'rental_due_reminder',
                message: $message,
                scheduledAt: $rental->due_at?->copy()->subHours($leadHours) ?? now(),
            );

            $sentCount++;
        }

        return $sentCount;
    }

    public function buildRentalInvoiceMessage(Rental $rental): string
    {
        $lines = [
            'Invoice Sewa Roc Advanture',
            'No Invoice: '.$rental->rental_no,
            'Penyewa: '.($rental->customer?->name ?? '-'),
            'Mulai Sewa: '.$this->formatDateTime($rental->starts_at),
            'Harus Kembali: '.$this->formatDateTime($rental->due_at),
            '',
            'Item Sewa:',
            ...$this->buildRentalItemLines($rental),
            '',
            'Total Sewa: '.$this->formatCurrency($rental->final_subtotal ?? $rental->subtotal),
            'Sudah Dibayar: '.$this->formatCurrency($rental->paid_amount),
            'Sisa Tagihan: '.$this->formatCurrency($rental->remaining_amount),
            '',
            'Admin: '.($rental->creator?->name ?? '-'),
            '',
            'Roc Advanture',
            'Jl. Raya Serang Km 16,8. Kp. Desa Talaga Rt 006/002, Cikupa, Tangerang',
            'Telp: 0887-1711-042',
        ];

        return implode(PHP_EOL, $lines);
    }

    public function buildRentalReminderMessage(Rental $rental): string
    {
        $lines = [
            'Halo '.($rental->customer?->name ?? 'Customer').',',
            'Ini pengingat pengembalian sewa dari Roc Advanture.',
            'No Rental: '.$rental->rental_no,
            'Batas kembali: '.$this->formatDateTime($rental->due_at),
            '',
            'Item Sewa:',
            ...$this->buildRentalItemLines($rental),
            '',
            'Sisa Tagihan: '.$this->formatCurrency($rental->remaining_amount),
            'Mohon barang dikembalikan tepat waktu. Terima kasih.',
        ];

        return implode(PHP_EOL, $lines);
    }

    private function buildRentalItemLines(Rental $rental): array
    {
        return $rental->items
            ->map(fn ($item) => sprintf(
                '- %s%s | %d hari',
                $item->product_name_snapshot,
                $item->inventoryUnit?->unit_code ? ' ('.$item->inventoryUnit->unit_code.')' : '',
                $item->days,
            ))
            ->all();
    }

    private function dispatchMessage(
        Rental $rental,
        string $phone,
        string $messageType,
        ?string $message,
        CarbonInterface $scheduledAt,
        array $extraPayload = [],
        ?array $attachment = null,
    ): WaLog {
        if (! $this->isEnabled()) {
            throw new RuntimeException('Integrasi WhatsApp sedang nonaktif.');
        }

        $normalizedPhone = $this->normalizePhoneNumber($phone);
        if ($normalizedPhone === null) {
            throw new RuntimeException('Nomor WhatsApp customer belum valid.');
        }

        $payload = array_merge([
            config('services.whatsapp.field_phone', 'target') => $normalizedPhone,
        ], $extraPayload);

        if ($message !== null && trim($message) !== '') {
            $payload[(string) config('services.whatsapp.field_message', 'message')] = $message;
        }

        $headers = [];
        if (config('services.whatsapp.auth_mode', 'header') === 'header') {
            $headers[(string) config('services.whatsapp.auth_header', 'Authorization')] = (string) config('services.whatsapp.token');
        } else {
            $payload[(string) config('services.whatsapp.field_token', 'token')] = (string) config('services.whatsapp.token');
        }

        $log = WaLog::query()->create([
            'rental_id' => $rental->id,
            'phone' => $normalizedPhone,
            'message_type' => $messageType,
            'scheduled_at' => $scheduledAt,
            'status' => 'pending',
            'payload' => [
                'message' => $message,
                'request' => $payload,
                'attachment' => $attachment['meta'] ?? null,
            ],
        ]);

        try {
            $request = $this->http
                ->timeout((int) config('services.whatsapp.timeout', 10))
                ->withHeaders($headers);

            if (! (bool) config('services.whatsapp.verify_ssl', true)) {
                $request = $request->withoutVerifying();
            }

            $request = $this->prepareRequest($request, $attachment);

            $response = $request
                ->post((string) config('services.whatsapp.api_url'), $payload)
                ->throw();

            $json = $response->json();

            $log->update([
                'sent_at' => now(),
                'status' => 'sent',
                'provider_message_id' => $this->extractProviderMessageId($json),
                'payload' => [
                    'message' => $message,
                    'request' => $payload,
                    'attachment' => $attachment['meta'] ?? null,
                    'response' => $json,
                ],
            ]);

            return $log->fresh();
        } catch (RequestException $exception) {
            $log->update([
                'status' => 'failed',
                'payload' => [
                    'message' => $message,
                    'request' => $payload,
                    'attachment' => $attachment['meta'] ?? null,
                    'error' => $exception->response?->json() ?? $exception->getMessage(),
                ],
            ]);

            throw new RuntimeException('Pengiriman WhatsApp gagal. Silakan cek token atau koneksi Fonnte.');
        }
    }

    private function resolveRentalPhone(Rental $rental): string
    {
        $phone = trim((string) $rental->customer?->phone_whatsapp);

        if ($phone === '') {
            throw new RuntimeException('Customer ini belum punya nomor WhatsApp.');
        }

        return $phone;
    }

    private function prepareRequest(PendingRequest $request, ?array $attachment): PendingRequest
    {
        if ($attachment === null) {
            return $request->asForm();
        }

        return $request->attach(
            $attachment['name'],
            $attachment['contents'],
            $attachment['filename'],
            $attachment['headers'] ?? [],
        );
    }

    private function normalizePhoneNumber(string $phone): ?string
    {
        $normalized = preg_replace('/\D+/', '', $phone);

        if ($normalized === null || $normalized === '') {
            return null;
        }

        if (str_starts_with($normalized, '0')) {
            return '62'.substr($normalized, 1);
        }

        if (str_starts_with($normalized, '62')) {
            return $normalized;
        }

        if (str_starts_with($normalized, '8')) {
            return '62'.$normalized;
        }

        return $normalized;
    }

    private function isEnabled(): bool
    {
        return (bool) config('services.whatsapp.enabled', false);
    }

    private function formatCurrency(string|float|int|null $value): string
    {
        return 'Rp'.number_format((float) ($value ?? 0), 0, ',', '.');
    }

    private function formatDateTime(?CarbonInterface $value): string
    {
        if ($value === null) {
            return '-';
        }

        return $value->timezone(config('app.timezone'))->translatedFormat('d M Y H:i');
    }

    private function extractProviderMessageId(mixed $json): ?string
    {
        if (! is_array($json)) {
            return null;
        }

        foreach (['id', 'messageId', 'message_id'] as $key) {
            if (isset($json[$key]) && $json[$key] !== null) {
                return $this->normalizeProviderMessageId($json[$key]);
            }
        }

        return null;
    }

    private function normalizeProviderMessageId(mixed $value): ?string
    {
        if (is_string($value)) {
            return trim($value) !== '' ? trim($value) : null;
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        if (is_array($value)) {
            foreach ($value as $nestedValue) {
                $normalized = $this->normalizeProviderMessageId($nestedValue);

                if ($normalized !== null) {
                    return $normalized;
                }
            }
        }

        return null;
    }
}
