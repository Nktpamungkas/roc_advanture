<?php

namespace App\Services;

use App\Http\Controllers\Admin\NotificationSettingController;
use App\Models\CombinedOrder;
use App\Models\Rental;
use App\Models\RentalExtension;
use App\Models\WaLog;
use App\Support\Rental\RentalStatuses;
use Carbon\CarbonInterface;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class WhatsappService
{
    public function __construct(
        private readonly HttpFactory $http,
        private readonly AppSettingService $appSettingService,
    ) {
    }

    public function sendRentalInvoice(Rental $rental): WaLog
    {
        $rental->loadMissing(['customer', 'creator', 'items.inventoryUnit', 'latestExtension']);

        $phone = $this->resolveRentalPhone($rental);
        $latestExtension = $rental->latestExtension;
        $messageType = $latestExtension !== null ? 'rental_extension_invoice_manual' : 'rental_invoice_manual';
        $message = $latestExtension !== null
            ? $this->buildRentalExtensionInvoiceMessage($rental, $latestExtension)
            : $this->buildRentalInvoiceMessage($rental);

        return $this->dispatchMessage(
            rental: $rental,
            phone: $phone,
            messageType: $messageType,
            message: $message,
            scheduledAt: now(),
        );
    }

    public function sendCombinedOrderInvoice(CombinedOrder $combinedOrder): WaLog
    {
        $combinedOrder->loadMissing([
            'creator',
            'rentals.customer',
            'rentals.items.inventoryUnit',
            'sales.items',
        ]);

        $rental = $combinedOrder->rentals->first();
        if ($rental === null) {
            throw new RuntimeException('Transaksi gabungan ini belum punya data rental yang bisa dikirim ke WhatsApp.');
        }

        $rental->setRelation('customer', $rental->customer);
        $phone = $this->resolveRentalPhone($rental);

        return $this->dispatchMessage(
            rental: $rental,
            phone: $phone,
            messageType: 'combined_order_invoice_manual',
            message: $this->buildCombinedOrderInvoiceMessage($combinedOrder),
            scheduledAt: now(),
        );
    }

    public function sendDueRentalReminders(): int
    {
        if (! $this->isEnabled()) {
            Log::info('WhatsApp reminder scheduler skipped because integration is disabled.');

            return 0;
        }

        $now = now();
        $sentCount = 0;
        $rentals = $this->baseReminderRentalQuery()->get();
        $rentalReminderEnabled = $this->isRentalReminderEnabled();
        $overdueReminderEnabled = $this->isOverdueReminderEnabled();
        $leadHours = $this->resolveReminderLeadHours();
        $overdueDelayHours = $this->resolveOverdueReminderDelayHours();

        Log::info('WhatsApp reminder scheduler cycle started.', [
            'now' => $now->format('Y-m-d H:i:s'),
            'rental_reminder_enabled' => $rentalReminderEnabled,
            'rental_reminder_lead_hours' => $leadHours,
            'overdue_reminder_enabled' => $overdueReminderEnabled,
            'overdue_reminder_delay_hours' => $overdueDelayHours,
            'candidate_rentals' => $rentals->count(),
        ]);

        if ($rentalReminderEnabled) {
            $template = $this->resolveRentalReminderTemplate();

            foreach ($rentals as $rental) {
                $triggerAt = $rental->due_at?->copy()->subHours($leadHours);

                if ($triggerAt === null) {
                    $this->logReminderSkipped('rental_due_reminder', $rental, 'missing_due_at', $now);

                    continue;
                }

                if ($now->lessThan($triggerAt)) {
                    $this->logReminderSkipped('rental_due_reminder', $rental, 'waiting_trigger_window', $now, [
                        'trigger_at' => $triggerAt->format('Y-m-d H:i:s'),
                        'due_at' => $rental->due_at?->format('Y-m-d H:i:s'),
                    ]);

                    continue;
                }

                if ($rental->due_at !== null && $now->greaterThan($rental->due_at)) {
                    $this->logReminderSkipped('rental_due_reminder', $rental, 'due_window_passed', $now, [
                        'trigger_at' => $triggerAt->format('Y-m-d H:i:s'),
                        'due_at' => $rental->due_at->format('Y-m-d H:i:s'),
                    ]);

                    continue;
                }

                $alreadySent = $this->hasExistingReminderLogForSchedule(
                    rentalId: $rental->id,
                    messageType: 'rental_due_reminder',
                    scheduledAt: $triggerAt,
                );

                if ($alreadySent) {
                    $this->logReminderSkipped('rental_due_reminder', $rental, 'already_sent', $now, [
                        'trigger_at' => $triggerAt->format('Y-m-d H:i:s'),
                        'due_at' => $rental->due_at?->format('Y-m-d H:i:s'),
                    ]);

                    continue;
                }

                $phone = $this->resolveRentalPhone($rental);
                $message = $this->buildReminderMessageFromTemplate($rental, $template);

                $this->dispatchMessage(
                    rental: $rental,
                    phone: $phone,
                    messageType: 'rental_due_reminder',
                    message: $message,
                    scheduledAt: $triggerAt,
                );

                $this->logReminderSent('rental_due_reminder', $rental, $now, [
                    'trigger_at' => $triggerAt->format('Y-m-d H:i:s'),
                    'due_at' => $rental->due_at?->format('Y-m-d H:i:s'),
                ]);

                $sentCount++;
            }
        } else {
            Log::info('WhatsApp due reminder scheduler skipped because the feature is disabled in settings.', [
                'now' => $now->format('Y-m-d H:i:s'),
            ]);
        }

        if ($overdueReminderEnabled) {
            $template = $this->resolveOverdueReminderTemplate();

            foreach ($rentals as $rental) {
                $triggerAt = $rental->due_at?->copy()->addHours($overdueDelayHours);

                if ($triggerAt === null) {
                    $this->logReminderSkipped('rental_overdue_reminder', $rental, 'missing_due_at', $now);

                    continue;
                }

                if ($now->lessThan($triggerAt)) {
                    $this->logReminderSkipped('rental_overdue_reminder', $rental, 'waiting_overdue_delay', $now, [
                        'trigger_at' => $triggerAt->format('Y-m-d H:i:s'),
                        'due_at' => $rental->due_at?->format('Y-m-d H:i:s'),
                    ]);

                    continue;
                }

                $alreadySent = $this->hasExistingReminderLogForSchedule(
                    rentalId: $rental->id,
                    messageType: 'rental_overdue_reminder',
                    scheduledAt: $triggerAt,
                );

                if ($alreadySent) {
                    $this->logReminderSkipped('rental_overdue_reminder', $rental, 'already_sent', $now, [
                        'trigger_at' => $triggerAt->format('Y-m-d H:i:s'),
                        'due_at' => $rental->due_at?->format('Y-m-d H:i:s'),
                    ]);

                    continue;
                }

                $phone = $this->resolveRentalPhone($rental);
                $message = $this->buildReminderMessageFromTemplate($rental, $template);

                $this->dispatchMessage(
                    rental: $rental,
                    phone: $phone,
                    messageType: 'rental_overdue_reminder',
                    message: $message,
                    scheduledAt: $triggerAt,
                );

                $this->logReminderSent('rental_overdue_reminder', $rental, $now, [
                    'trigger_at' => $triggerAt->format('Y-m-d H:i:s'),
                    'due_at' => $rental->due_at?->format('Y-m-d H:i:s'),
                ]);

                $sentCount++;
            }
        } else {
            Log::info('WhatsApp overdue reminder scheduler skipped because the feature is disabled in settings.', [
                'now' => $now->format('Y-m-d H:i:s'),
            ]);
        }

        Log::info('WhatsApp reminder scheduler cycle finished.', [
            'now' => $now->format('Y-m-d H:i:s'),
            'sent_count' => $sentCount,
        ]);

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
        ];

        if (filled($rental->guarantee_note)) {
            $lines[] = 'Jaminan: '.$rental->guarantee_note;
        }

        $lines = [
            ...$lines,
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

    public function buildRentalExtensionInvoiceMessage(Rental $rental, RentalExtension $extension): string
    {
        $additionalDays = max(0, $extension->new_total_days - $extension->previous_total_days);
        $additionalCost = max(0, (float) $extension->new_subtotal - (float) $extension->previous_subtotal);

        $lines = [
            'Invoice Perpanjangan Sewa Roc Advanture',
            'No Invoice: '.$rental->rental_no,
            'Penyewa: '.($rental->customer?->name ?? '-'),
            'Mulai Sewa: '.$this->formatDateTime($rental->starts_at),
            'Jatuh Tempo Lama: '.$this->formatDateTime($extension->previous_due_at),
            'Jatuh Tempo Baru: '.$this->formatDateTime($extension->new_due_at),
            'Tambahan Hari: '.$additionalDays.' hari',
            'Tambahan Biaya: '.$this->formatCurrency($additionalCost),
        ];

        if ((float) $extension->extension_payment_amount > 0) {
            $lines[] = 'Pembayaran Saat Perpanjang: '.$this->formatCurrency($extension->extension_payment_amount);
        }

        if (filled($rental->guarantee_note)) {
            $lines[] = 'Jaminan: '.$rental->guarantee_note;
        }

        $lines = [
            ...$lines,
            '',
            'Item Sewa:',
            ...$this->buildRentalItemLines($rental),
            '',
            'Total Sewa Terbaru: '.$this->formatCurrency($rental->final_subtotal ?? $rental->subtotal),
            'Sudah Dibayar: '.$this->formatCurrency($rental->paid_amount),
            'Sisa Tagihan Terbaru: '.$this->formatCurrency($rental->remaining_amount),
            '',
            'Admin: '.($rental->creator?->name ?? '-'),
            '',
            'Roc Advanture',
            'Jl. Raya Serang Km 16,8. Kp. Desa Talaga Rt 006/002, Cikupa, Tangerang',
            'Telp: 0887-1711-042',
        ];

        return implode(PHP_EOL, $lines);
    }

    public function buildCombinedOrderInvoiceMessage(CombinedOrder $combinedOrder): string
    {
        $rental = $combinedOrder->rentals->first();
        $sale = $combinedOrder->sales->first();

        $lines = [
            'Invoice Gabungan Roc Advanture',
            'No Invoice: '.$combinedOrder->combined_no,
            'Customer: '.($combinedOrder->customer_name ?? '-'),
            'Tanggal Transaksi: '.$this->formatDateTime($combinedOrder->ordered_at),
        ];

        if ($rental !== null) {
            $lines[] = 'Mulai Sewa: '.$this->formatDateTime($rental->starts_at);
            $lines[] = 'Harus Kembali: '.$this->formatDateTime($rental->due_at);

            if (filled($rental->guarantee_note)) {
                $lines[] = 'Jaminan: '.$rental->guarantee_note;
            }
        }

        if ($rental !== null) {
            $lines = [
                ...$lines,
                '',
                'Item Sewa:',
                ...$this->buildRentalItemLines($rental),
            ];
        }

        if ($sale !== null) {
            $saleLines = $sale->items
                ->map(fn ($item) => sprintf(
                    '- %s%s | Qty %d',
                    $item->product_name_snapshot,
                    $item->sku_snapshot ? ' ('.$item->sku_snapshot.')' : '',
                    $item->qty,
                ))
                ->all();

            $lines = [
                ...$lines,
                '',
                'Item Jual:',
                ...$saleLines,
            ];
        }

        $lines = [
            ...$lines,
            '',
            'Total Sewa: '.$this->formatCurrency($combinedOrder->rental_total),
            'Total Jual: '.$this->formatCurrency($combinedOrder->sale_total),
            'Grand Total: '.$this->formatCurrency($combinedOrder->subtotal),
            'Sudah Dibayar: '.$this->formatCurrency($combinedOrder->paid_amount),
            'Sisa Tagihan: '.$this->formatCurrency($combinedOrder->remaining_amount),
            '',
            'Admin: '.($combinedOrder->creator?->name ?? '-'),
            '',
            'Roc Advanture',
            'Jl. Raya Serang Km 16,8. Kp. Desa Talaga Rt 006/002, Cikupa, Tangerang',
            'Telp: 0887-1711-042',
        ];

        return implode(PHP_EOL, $lines);
    }

    public function buildRentalReminderMessage(Rental $rental): string
    {
        return $this->buildReminderMessageFromTemplate($rental, $this->resolveRentalReminderTemplate());
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

            Log::info('WhatsApp message sent successfully.', [
                'rental_id' => $rental->id,
                'rental_no' => $rental->rental_no,
                'message_type' => $messageType,
                'phone' => $normalizedPhone,
                'provider_message_id' => $log->provider_message_id,
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

            Log::error('WhatsApp message failed to send.', [
                'rental_id' => $rental->id,
                'rental_no' => $rental->rental_no,
                'message_type' => $messageType,
                'phone' => $normalizedPhone,
                'error' => $exception->response?->json() ?? $exception->getMessage(),
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

    private function isRentalReminderEnabled(): bool
    {
        return $this->appSettingService->getBool(NotificationSettingController::RENTAL_REMINDER_ENABLED_KEY, true);
    }

    private function isOverdueReminderEnabled(): bool
    {
        return $this->appSettingService->getBool(NotificationSettingController::OVERDUE_REMINDER_ENABLED_KEY, false);
    }

    private function resolveReminderLeadHours(): int
    {
        $defaultLeadHours = max(1, (int) config('services.whatsapp.rental_reminder_lead_hours', 6));

        return max(
            1,
            $this->appSettingService->getInt(NotificationSettingController::RENTAL_REMINDER_LEAD_HOURS_KEY, $defaultLeadHours),
        );
    }

    private function resolveOverdueReminderDelayHours(): int
    {
        return max(
            1,
            $this->appSettingService->getInt(NotificationSettingController::OVERDUE_REMINDER_DELAY_HOURS_KEY, 2),
        );
    }

    private function resolveRentalReminderTemplate(): string
    {
        return $this->appSettingService->getString(
            NotificationSettingController::RENTAL_REMINDER_TEMPLATE_KEY,
            NotificationSettingController::defaultRentalReminderTemplate(),
        ) ?? NotificationSettingController::defaultRentalReminderTemplate();
    }

    private function resolveOverdueReminderTemplate(): string
    {
        return $this->appSettingService->getString(
            NotificationSettingController::OVERDUE_REMINDER_TEMPLATE_KEY,
            NotificationSettingController::defaultOverdueReminderTemplate(),
        ) ?? NotificationSettingController::defaultOverdueReminderTemplate();
    }

    private function baseReminderRentalQuery()
    {
        return Rental::query()
            ->with(['customer', 'creator', 'items.inventoryUnit'])
            ->whereIn('rental_status', [
                RentalStatuses::BOOKED,
                RentalStatuses::PICKED_UP,
                RentalStatuses::LATE,
            ])
            ->whereNotNull('due_at')
            ->whereNotNull('customer_id')
            ->whereHas('customer', fn ($query) => $query->whereNotNull('phone_whatsapp')->where('phone_whatsapp', '!=', ''));
    }

    private function buildReminderMessageFromTemplate(Rental $rental, string $template): string
    {
        $message = strtr(str_replace("\r\n", "\n", $template), [
            '{customer_name}' => $rental->customer?->name ?? 'Customer',
            '{rental_no}' => $rental->rental_no ?? '-',
            '{starts_at}' => $this->formatDateTime($rental->starts_at),
            '{due_at}' => $this->formatDateTime($rental->due_at),
            '{items}' => implode(PHP_EOL, $this->buildRentalItemLines($rental)),
            '{subtotal}' => $this->formatCurrency($rental->final_subtotal ?? $rental->subtotal),
            '{remaining_amount}' => $this->formatCurrency($rental->remaining_amount),
            '{guarantee_note}' => $rental->guarantee_note ?: '-',
            '{admin_name}' => $rental->creator?->name ?? '-',
            '{store_name}' => (string) config('app.name', 'Roc Advanture'),
        ]);

        return trim((string) preg_replace("/\n{3,}/", "\n\n", $message));
    }

    private function hasExistingReminderLogForSchedule(int $rentalId, string $messageType, CarbonInterface $scheduledAt): bool
    {
        return WaLog::query()
            ->where('rental_id', $rentalId)
            ->where('message_type', $messageType)
            ->whereIn('status', ['pending', 'sent'])
            ->where('scheduled_at', $scheduledAt->format('Y-m-d H:i:s'))
            ->exists();
    }

    private function logReminderSkipped(string $messageType, Rental $rental, string $reason, CarbonInterface $now, array $context = []): void
    {
        $payload = array_merge([
            'rental_id' => $rental->id,
            'rental_no' => $rental->rental_no,
            'message_type' => $messageType,
            'reason' => $reason,
            'now' => $now->format('Y-m-d H:i:s'),
            'customer_phone' => $rental->customer?->phone_whatsapp,
        ], $context);

        Log::info('WhatsApp reminder skipped.', $payload);
    }

    private function logReminderSent(string $messageType, Rental $rental, CarbonInterface $now, array $context = []): void
    {
        $payload = array_merge([
            'rental_id' => $rental->id,
            'rental_no' => $rental->rental_no,
            'message_type' => $messageType,
            'now' => $now->format('Y-m-d H:i:s'),
            'customer_phone' => $rental->customer?->phone_whatsapp,
        ], $context);

        Log::info('WhatsApp reminder dispatched.', $payload);
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
