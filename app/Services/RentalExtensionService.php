<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\PaymentMethodConfig;
use App\Models\Rental;
use App\Models\User;
use App\Models\WaLog;
use App\Support\Rental\PaymentKinds;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RentalExtensionService
{
    public function extend(User $actor, Rental $rental, array $validated): Rental
    {
        return DB::transaction(function () use ($actor, $rental, $validated): Rental {
            /** @var Rental|null $lockedRental */
            $lockedRental = Rental::query()
                ->with(['items.inventoryUnit.product', 'customer', 'creator', 'payments.receiver', 'payments.paymentMethodConfig'])
                ->whereKey($rental->id)
                ->lockForUpdate()
                ->first();

            if ($lockedRental === null) {
                throw ValidationException::withMessages([
                    'due_at' => 'Transaksi rental tidak ditemukan.',
                ]);
            }

            if (! in_array($lockedRental->rental_status, [RentalStatuses::PICKED_UP, RentalStatuses::LATE], true)) {
                throw ValidationException::withMessages([
                    'due_at' => 'Hanya rental aktif yang bisa diperpanjang.',
                ]);
            }

            if ($lockedRental->starts_at === null || $lockedRental->due_at === null) {
                throw ValidationException::withMessages([
                    'due_at' => 'Data jadwal rental belum lengkap.',
                ]);
            }

            $newDueAt = Carbon::parse($validated['due_at']);

            if (! $newDueAt->gt($lockedRental->due_at)) {
                throw ValidationException::withMessages([
                    'due_at' => 'Tanggal/jam perpanjangan harus lebih besar dari jatuh tempo saat ini.',
                ]);
            }

            $newTotalDays = $this->calculateTotalDays($lockedRental->starts_at, $newDueAt);
            $newSubtotal = $this->calculateSubtotal($lockedRental, $newTotalDays);
            $extensionPaymentAmount = round((float) ($validated['extension_payment_amount'] ?? 0), 2);
            $newPaidAmount = round((float) $lockedRental->paid_amount + $extensionPaymentAmount, 2);
            $newRemainingAmount = round(max(0, $newSubtotal - $newPaidAmount), 2);
            $paymentMethodConfig = $this->resolvePaymentMethodConfig($validated['payment_method_config_id'] ?? null);

            $lockedRental->update([
                'due_at' => $newDueAt,
                'total_days' => $newTotalDays,
                'subtotal' => $newSubtotal,
                'paid_amount' => $newPaidAmount,
                'remaining_amount' => $newRemainingAmount,
                'payment_status' => $this->determinePaymentStatus($newSubtotal, $newPaidAmount),
                'rental_status' => $newDueAt->isPast() ? RentalStatuses::LATE : RentalStatuses::PICKED_UP,
                'final_total_days' => null,
                'final_subtotal' => null,
                'settlement_basis' => null,
            ]);

            foreach ($lockedRental->items as $item) {
                $item->update([
                    'days' => $newTotalDays,
                    'line_total' => round((float) $item->daily_rate_snapshot * $newTotalDays, 2),
                ]);
            }

            if ($extensionPaymentAmount > 0) {
                Payment::query()->create([
                    'rental_id' => $lockedRental->id,
                    'received_by' => $actor->id,
                    'payment_method_config_id' => $paymentMethodConfig?->id,
                    'payment_kind' => PaymentKinds::SETTLEMENT,
                    'amount' => $extensionPaymentAmount,
                    'paid_at' => now(),
                    'method' => $paymentMethodConfig?->type,
                    'method_label_snapshot' => $paymentMethodConfig?->name,
                    'method_type_snapshot' => $paymentMethodConfig?->type,
                    'instructions_snapshot' => $paymentMethodConfig?->instructions,
                    'notes' => $validated['payment_notes'] ?? null,
                ]);
            }

            $this->resetScheduledReminders($lockedRental);

            return $lockedRental->fresh([
                'customer',
                'seasonRule',
                'creator',
                'paymentMethodConfig',
                'items.inventoryUnit.product',
                'payments.receiver',
                'payments.paymentMethodConfig',
            ]);
        });
    }

    private function resolvePaymentMethodConfig(?int $paymentMethodConfigId): ?PaymentMethodConfig
    {
        if ($paymentMethodConfigId === null) {
            return null;
        }

        return PaymentMethodConfig::query()->find($paymentMethodConfigId);
    }

    private function calculateTotalDays(CarbonInterface $startsAt, CarbonInterface $dueAt): int
    {
        return max(1, (int) ceil($startsAt->diffInMinutes($dueAt) / 1440));
    }

    private function calculateSubtotal(Rental $rental, int $totalDays): float
    {
        return round(
            $rental->items->sum(fn ($item) => ((float) $item->daily_rate_snapshot) * $totalDays),
            2,
        );
    }

    private function determinePaymentStatus(float $subtotal, float $paidAmount): string
    {
        if ($paidAmount >= $subtotal) {
            return RentalPaymentStatuses::PAID;
        }

        if ($paidAmount > 0) {
            return RentalPaymentStatuses::DP_PAID;
        }

        return RentalPaymentStatuses::UNPAID;
    }

    private function resetScheduledReminders(Rental $rental): void
    {
        WaLog::query()
            ->where('rental_id', $rental->id)
            ->whereIn('message_type', ['rental_due_reminder', 'rental_overdue_reminder'])
            ->where('status', 'pending')
            ->delete();
    }
}
