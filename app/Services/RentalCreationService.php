<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\Payment;
use App\Models\PaymentMethodConfig;
use App\Models\Rental;
use App\Models\SeasonRule;
use App\Models\User;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentKinds;
use App\Support\Rental\PaymentMethods;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use App\Support\Rental\SeasonDpTypes;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RentalCreationService
{
    public function create(User $actor, array $validated): Rental
    {
        return DB::transaction(function () use ($actor, $validated): Rental {
            $startsAt = Carbon::parse($validated['starts_at']);
            $dueAt = $this->resolveDueAt($startsAt, $validated);
            $customer = $this->resolveCustomer($validated);
            $paymentMethodConfig = $this->resolvePaymentMethodConfig($validated);

            $inventoryUnits = InventoryUnit::query()
                ->with('product:id,name,daily_rate,active')
                ->whereIn('id', $validated['inventory_unit_ids'])
                ->lockForUpdate()
                ->get()
                ->sortBy(fn (InventoryUnit $inventoryUnit) => sprintf(
                    '%s-%s',
                    $inventoryUnit->product?->name ?? '',
                    $inventoryUnit->unit_code,
                ))
                ->values();

            $requestedUnitCount = count($validated['inventory_unit_ids']);
            if ($inventoryUnits->count() !== $requestedUnitCount) {
                throw ValidationException::withMessages([
                    'inventory_unit_ids' => 'Beberapa unit inventaris yang dipilih tidak ditemukan lagi. Silakan refresh halaman.',
                ]);
            }

            $unavailableUnits = $inventoryUnits
                ->filter(fn (InventoryUnit $inventoryUnit) => ! in_array($inventoryUnit->status, [
                    InventoryUnitStatuses::READY_CLEAN,
                    InventoryUnitStatuses::READY_UNCLEAN,
                ], true))
                ->pluck('unit_code')
                ->all();

            if ($unavailableUnits !== []) {
                throw ValidationException::withMessages([
                    'inventory_unit_ids' => 'Unit inventaris berikut sudah tidak tersedia: '.implode(', ', $unavailableUnits).'.',
                ]);
            }

            $inactiveProducts = $inventoryUnits
                ->filter(fn (InventoryUnit $inventoryUnit) => ! (bool) $inventoryUnit->product?->active)
                ->pluck('product.name')
                ->filter()
                ->unique()
                ->values()
                ->all();

            if ($inactiveProducts !== []) {
                throw ValidationException::withMessages([
                    'inventory_unit_ids' => 'Produk nonaktif tidak bisa disewakan: '.implode(', ', $inactiveProducts).'.',
                ]);
            }

            $totalDays = $this->calculateTotalDays($startsAt, $dueAt);
            $subtotal = round($this->calculateSubtotal($inventoryUnits, $totalDays), 2);
            $seasonRule = $this->resolveSeasonRule($startsAt);
            $dpRequired = (bool) $seasonRule?->dp_required;
            $requiredDpAmount = round($this->calculateRequiredDp($subtotal, $seasonRule), 2);
            $paidAmount = round((float) ($validated['paid_amount'] ?? 0), 2);
            $remainingAmount = round(max(0, $subtotal - $paidAmount), 2);

            $rental = Rental::query()->create([
                'rental_no' => $this->generateRentalNumber(),
                'customer_id' => $customer->id,
                'season_rule_id' => $seasonRule?->id,
                'payment_method_config_id' => $paymentMethodConfig?->id,
                'payment_method_name_snapshot' => $paymentMethodConfig?->name,
                'payment_method_type_snapshot' => $paymentMethodConfig?->type ?? ($validated['payment_method'] ?? null),
                'payment_qr_image_path_snapshot' => $paymentMethodConfig?->qr_image_path,
                'payment_transfer_bank_snapshot' => $paymentMethodConfig?->bank_name,
                'payment_transfer_account_number_snapshot' => $paymentMethodConfig?->account_number,
                'payment_transfer_account_name_snapshot' => $paymentMethodConfig?->account_name,
                'payment_instruction_snapshot' => $paymentMethodConfig?->instructions,
                'created_by' => $actor->id,
                'starts_at' => $startsAt,
                'due_at' => $dueAt,
                'total_days' => $totalDays,
                'final_total_days' => null,
                'dp_required' => $dpRequired,
                'subtotal' => $subtotal,
                'final_subtotal' => null,
                'dp_amount' => $requiredDpAmount,
                'dp_override_reason' => $validated['dp_override_reason'] ?? null,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
                'payment_status' => $this->determinePaymentStatus($subtotal, $paidAmount),
                'settlement_basis' => null,
                'rental_status' => RentalStatuses::PICKED_UP,
                'notes' => $validated['notes'] ?? null,
                'guarantee_note' => $validated['guarantee_note'] ?? null,
            ]);

            $rental->items()->createMany(
                $inventoryUnits
                    ->map(fn (InventoryUnit $inventoryUnit) => [
                        'inventory_unit_id' => $inventoryUnit->id,
                        'product_name_snapshot' => $inventoryUnit->product?->name,
                        'daily_rate_snapshot' => $inventoryUnit->product?->daily_rate ?? 0,
                        'days' => $totalDays,
                        'line_total' => round(((float) $inventoryUnit->product?->daily_rate) * $totalDays, 2),
                        'status_at_checkout' => $inventoryUnit->status,
                        'notes' => null,
                    ])
                    ->all(),
            );

            InventoryUnit::query()
                ->whereIn('id', $inventoryUnits->pluck('id'))
                ->update(['status' => InventoryUnitStatuses::RENTED]);

            if ($paidAmount > 0) {
                Payment::query()->create([
                    'rental_id' => $rental->id,
                    'received_by' => $actor->id,
                    'payment_method_config_id' => $paymentMethodConfig?->id,
                    'payment_kind' => $paidAmount >= $subtotal ? PaymentKinds::SETTLEMENT : PaymentKinds::DP,
                    'amount' => $paidAmount,
                    'paid_at' => now(),
                    'method' => $paymentMethodConfig?->type ?? ($validated['payment_method'] ?? null),
                    'method_label_snapshot' => $paymentMethodConfig?->name
                        ?? PaymentMethods::label($validated['payment_method'] ?? null),
                    'method_type_snapshot' => $paymentMethodConfig?->type ?? ($validated['payment_method'] ?? null),
                    'instructions_snapshot' => $paymentMethodConfig?->instructions,
                    'notes' => $validated['payment_notes'] ?? null,
                ]);
            }

            return $rental->load([
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

    private function resolveCustomer(array $validated): Customer
    {
        if (! empty($validated['customer_id'])) {
            return Customer::query()->findOrFail($validated['customer_id']);
        }

        $customer = Customer::query()->firstOrNew([
            'phone_whatsapp' => (string) $validated['customer_phone_whatsapp'],
        ]);

        $customer->fill([
            'name' => $validated['customer_name'],
            'address' => $validated['customer_address'] ?? $customer->address,
        ]);

        $customer->save();

        return $customer;
    }

    private function resolvePaymentMethodConfig(array $validated): ?PaymentMethodConfig
    {
        if (empty($validated['payment_method_config_id'])) {
            return null;
        }

        return PaymentMethodConfig::query()->find($validated['payment_method_config_id']);
    }

    private function resolveDueAt(CarbonInterface $startsAt, array $validated): CarbonInterface
    {
        if (! empty($validated['due_at'])) {
            return Carbon::parse($validated['due_at']);
        }

        if (! empty($validated['rental_days'])) {
            return $startsAt->copy()->addDays((int) $validated['rental_days']);
        }

        return $startsAt->copy();
    }

    private function calculateTotalDays(CarbonInterface $startsAt, CarbonInterface $dueAt): int
    {
        return max(1, (int) ceil($startsAt->diffInMinutes($dueAt) / 1440));
    }

    private function calculateSubtotal(Collection $inventoryUnits, int $totalDays): float
    {
        return (float) $inventoryUnits->sum(
            fn (InventoryUnit $inventoryUnit) => ((float) $inventoryUnit->product?->daily_rate) * $totalDays,
        );
    }

    private function resolveSeasonRule(CarbonInterface $startsAt): ?SeasonRule
    {
        return SeasonRule::query()
            ->where('active', true)
            ->whereDate('start_date', '<=', $startsAt->toDateString())
            ->whereDate('end_date', '>=', $startsAt->toDateString())
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->first();
    }

    private function calculateRequiredDp(float $subtotal, ?SeasonRule $seasonRule): float
    {
        if (! $seasonRule?->dp_required) {
            return 0;
        }

        return match ($seasonRule->dp_type) {
            SeasonDpTypes::FIXED_AMOUNT => min($subtotal, (float) $seasonRule->dp_value),
            SeasonDpTypes::PERCENTAGE => min($subtotal, round($subtotal * ((float) $seasonRule->dp_value / 100), 2)),
            default => 0,
        };
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

    private function generateRentalNumber(): string
    {
        $datePrefix = now()->format('Ymd');
        $basePrefix = 'ROC-RENT-'.$datePrefix;
        $todayCount = Rental::query()
            ->where('rental_no', 'like', $basePrefix.'-%')
            ->count() + 1;

        return sprintf('%s-%04d', $basePrefix, $todayCount);
    }
}
