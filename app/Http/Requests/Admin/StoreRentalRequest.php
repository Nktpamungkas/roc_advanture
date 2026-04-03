<?php

namespace App\Http\Requests\Admin;

use App\Models\InventoryUnit;
use App\Models\PaymentMethodConfig;
use App\Models\SeasonRule;
use App\Services\AdminAccessService;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentMethods;
use App\Support\Rental\SeasonDpTypes;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreRentalRequest extends FormRequest
{
    public function authorize(AdminAccessService $adminAccessService): bool
    {
        return $this->user() !== null && $adminAccessService->canAccessBackOffice($this->user());
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'customer_id' => $this->filled('customer_id') ? (int) $this->input('customer_id') : null,
            'customer_name' => $this->filled('customer_name') ? trim((string) $this->input('customer_name')) : null,
            'customer_phone_whatsapp' => $this->filled('customer_phone_whatsapp') ? trim((string) $this->input('customer_phone_whatsapp')) : null,
            'customer_address' => $this->filled('customer_address') ? trim((string) $this->input('customer_address')) : null,
            'rental_days' => $this->filled('rental_days') ? (int) $this->input('rental_days') : null,
            'paid_amount' => $this->filled('paid_amount') ? $this->input('paid_amount') : 0,
            'payment_method' => $this->filled('payment_method') ? $this->input('payment_method') : null,
            'payment_method_config_id' => $this->filled('payment_method_config_id') ? (int) $this->input('payment_method_config_id') : null,
            'payment_notes' => $this->filled('payment_notes') ? $this->input('payment_notes') : null,
            'dp_override_reason' => $this->filled('dp_override_reason') ? trim((string) $this->input('dp_override_reason')) : null,
            'guarantee_note' => $this->filled('guarantee_note') ? trim((string) $this->input('guarantee_note')) : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'customer_name' => ['nullable', 'string', 'max:255', Rule::requiredIf(fn (): bool => ! $this->filled('customer_id'))],
            'customer_phone_whatsapp' => ['nullable', 'string', 'max:25', Rule::requiredIf(fn (): bool => ! $this->filled('customer_id'))],
            'customer_address' => ['nullable', 'string', 'max:5000'],
            'starts_at' => ['required', 'date'],
            'due_at' => ['nullable', 'date'],
            'rental_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'inventory_unit_ids' => ['required', 'array', 'min:1'],
            'inventory_unit_ids.*' => ['required', 'integer', 'distinct', 'exists:inventory_units,id'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', Rule::in(PaymentMethods::all())],
            'payment_method_config_id' => ['nullable', 'integer', 'exists:payment_method_configs,id'],
            'payment_notes' => ['nullable', 'string', 'max:5000'],
            'dp_override_reason' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'guarantee_note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $unitIds = collect($this->input('inventory_unit_ids', []))
                ->filter(fn (mixed $value) => filled($value))
                ->map(fn (mixed $value) => (int) $value)
                ->values();

            if ($unitIds->isEmpty()) {
                return;
            }

            $inventoryUnits = InventoryUnit::query()
                ->with('product:id,name,active,daily_rate')
                ->whereIn('id', $unitIds)
                ->get();

            $unavailableUnits = $inventoryUnits
                ->filter(fn (InventoryUnit $inventoryUnit) => ! in_array($inventoryUnit->status, [
                    InventoryUnitStatuses::READY_CLEAN,
                    InventoryUnitStatuses::READY_UNCLEAN,
                ], true))
                ->pluck('unit_code')
                ->all();

            if ($unavailableUnits !== []) {
                $validator->errors()->add(
                    'inventory_unit_ids',
                    'Unit inventaris berikut sudah tidak ready untuk disewakan: '.implode(', ', $unavailableUnits).'.',
                );
            }

            $inactiveProducts = $inventoryUnits
                ->filter(fn (InventoryUnit $inventoryUnit) => ! (bool) $inventoryUnit->product?->active)
                ->pluck('product.name')
                ->filter()
                ->unique()
                ->values()
                ->all();

            if ($inactiveProducts !== []) {
                $validator->errors()->add(
                    'inventory_unit_ids',
                    'Produk nonaktif tidak bisa disewakan: '.implode(', ', $inactiveProducts).'.',
                );
            }

            if ($validator->errors()->hasAny(['starts_at', 'due_at', 'rental_days', 'inventory_unit_ids'])) {
                return;
            }

            $startsAt = Carbon::parse((string) $this->input('starts_at'));
            $rentalDays = $this->filled('rental_days') ? (int) $this->input('rental_days') : null;
            $dueAt = $this->filled('due_at')
                ? Carbon::parse((string) $this->input('due_at'))
                : null;

            if ($rentalDays === null && $dueAt === null) {
                $validator->errors()->add('rental_days', 'Durasi sewa wajib diisi.');

                return;
            }

            if ($dueAt === null && $rentalDays !== null) {
                $dueAt = $startsAt->copy()->addDays($rentalDays);
            }

            if ($dueAt === null || ! $dueAt->gt($startsAt)) {
                $validator->errors()->add('due_at', 'Waktu harus kembali harus lebih besar dari mulai sewa.');

                return;
            }

            $totalDays = max(1, (int) ceil($startsAt->diffInMinutes($dueAt) / 1440));
            $subtotal = round(
                $inventoryUnits->sum(fn (InventoryUnit $inventoryUnit) => ((float) $inventoryUnit->product?->daily_rate) * $totalDays),
                2,
            );

            $paidAmount = (float) $this->input('paid_amount', 0);
            if ($paidAmount > $subtotal) {
                $validator->errors()->add('paid_amount', 'Pembayaran awal tidak boleh melebihi total transaksi.');
            }

            if ($this->filled('payment_method_config_id')) {
                $paymentMethodConfig = PaymentMethodConfig::query()->find((int) $this->input('payment_method_config_id'));

                if (! $paymentMethodConfig?->active) {
                    $validator->errors()->add('payment_method_config_id', 'Metode pembayaran yang dipilih tidak aktif.');
                }
            }

            $seasonRule = SeasonRule::query()
                ->where('active', true)
                ->whereDate('start_date', '<=', $startsAt->toDateString())
                ->whereDate('end_date', '>=', $startsAt->toDateString())
                ->orderByDesc('start_date')
                ->orderByDesc('id')
                ->first();

            if (! $seasonRule?->dp_required) {
                return;
            }

            $requiredDp = $seasonRule->dp_type === SeasonDpTypes::FIXED_AMOUNT
                ? min($subtotal, (float) $seasonRule->dp_value)
                : min($subtotal, round($subtotal * ((float) $seasonRule->dp_value / 100), 2));

            if ($paidAmount < $requiredDp && blank($this->input('dp_override_reason'))) {
                $validator->errors()->add(
                    'dp_override_reason',
                    'Tanggal sewa masuk season dengan DP rekomendasi '.number_format($requiredDp, 0, ',', '.').'. Isi alasan override jika ingin tetap lanjut.',
                );
            }
        });
    }
}
