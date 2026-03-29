<?php

namespace App\Http\Requests\Admin;

use App\Models\InventoryUnit;
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
            'paid_amount' => $this->filled('paid_amount') ? $this->input('paid_amount') : 0,
            'payment_method' => $this->filled('payment_method') ? $this->input('payment_method') : null,
            'payment_notes' => $this->filled('payment_notes') ? $this->input('payment_notes') : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'starts_at' => ['required', 'date'],
            'due_at' => ['required', 'date', 'after:starts_at'],
            'inventory_unit_ids' => ['required', 'array', 'min:1'],
            'inventory_unit_ids.*' => ['required', 'integer', 'distinct', 'exists:inventory_units,id'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => [
                Rule::requiredIf(fn (): bool => (float) $this->input('paid_amount', 0) > 0),
                'nullable',
                'string',
                Rule::in(PaymentMethods::all()),
            ],
            'payment_notes' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
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

            if ($validator->errors()->hasAny(['starts_at', 'due_at', 'inventory_unit_ids'])) {
                return;
            }

            $startsAt = Carbon::parse((string) $this->input('starts_at'));
            $dueAt = Carbon::parse((string) $this->input('due_at'));
            $totalDays = max(1, (int) ceil($startsAt->diffInMinutes($dueAt) / 1440));
            $subtotal = round(
                $inventoryUnits->sum(fn (InventoryUnit $inventoryUnit) => ((float) $inventoryUnit->product?->daily_rate) * $totalDays),
                2,
            );

            $paidAmount = (float) $this->input('paid_amount', 0);
            if ($paidAmount > $subtotal) {
                $validator->errors()->add('paid_amount', 'Pembayaran awal tidak boleh melebihi total transaksi.');
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

            if ($paidAmount < $requiredDp) {
                $validator->errors()->add(
                    'paid_amount',
                    'Tanggal sewa masuk season dengan DP wajib. Minimal pembayaran awal '.number_format($requiredDp, 0, ',', '.').'.',
                );
            }
        });
    }
}
