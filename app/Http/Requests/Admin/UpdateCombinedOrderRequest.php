<?php

namespace App\Http\Requests\Admin;

use App\Models\CombinedOrder;
use App\Models\InventoryUnit;
use App\Models\PaymentMethodConfig;
use App\Models\SaleProduct;
use App\Models\SeasonRule;
use App\Services\AdminAccessService;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\RentalStatuses;
use App\Support\Rental\SeasonDpTypes;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateCombinedOrderRequest extends FormRequest
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
            'guarantee_note' => $this->filled('guarantee_note') ? trim((string) $this->input('guarantee_note')) : null,
            'rental_days' => $this->filled('rental_days') ? (int) $this->input('rental_days') : null,
            'paid_amount' => $this->filled('paid_amount') ? $this->input('paid_amount') : 0,
            'payment_method_config_id' => $this->filled('payment_method_config_id') ? (int) $this->input('payment_method_config_id') : null,
            'dp_override_reason' => $this->filled('dp_override_reason') ? trim((string) $this->input('dp_override_reason')) : null,
            'notes' => $this->filled('notes') ? trim((string) $this->input('notes')) : null,
            'sale_items' => collect($this->input('sale_items', []))
                ->map(fn (mixed $item) => is_array($item)
                    ? [
                        'sale_product_id' => filled($item['sale_product_id'] ?? null) ? (int) $item['sale_product_id'] : null,
                        'qty' => filled($item['qty'] ?? null) ? (int) $item['qty'] : null,
                    ]
                    : $item)
                ->all(),
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
            'guarantee_note' => ['nullable', 'string', 'max:255'],
            'starts_at' => ['required', 'date'],
            'due_at' => ['nullable', 'date'],
            'rental_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'inventory_unit_ids' => ['required', 'array', 'min:1'],
            'inventory_unit_ids.*' => ['required', 'integer', 'distinct', 'exists:inventory_units,id'],
            'sale_items' => ['required', 'array', 'min:1'],
            'sale_items.*.sale_product_id' => ['required', 'integer', 'distinct', 'exists:sale_products,id'],
            'sale_items.*.qty' => ['required', 'integer', 'min:1'],
            'paid_amount' => ['required', 'numeric', 'min:0'],
            'payment_method_config_id' => ['required', 'integer', 'exists:payment_method_configs,id'],
            'dp_override_reason' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $combinedOrder = $this->route('combinedOrder');
            if (! $combinedOrder instanceof CombinedOrder) {
                return;
            }

            $combinedOrder->loadMissing([
                'rentals.items.inventoryUnit.product',
                'rentals.payments',
                'rentals.returnRecord',
                'rentals.latestExtension',
                'sales.items.saleProduct',
            ]);

            $rental = $combinedOrder->rentals->first();
            $sale = $combinedOrder->sales->first();

            if ($rental === null || $sale === null) {
                $validator->errors()->add('starts_at', 'Transaksi gabungan tidak lengkap dan tidak bisa diedit.');

                return;
            }

            if (! in_array($rental->rental_status, [RentalStatuses::BOOKED, RentalStatuses::PICKED_UP, RentalStatuses::LATE], true)) {
                $validator->errors()->add('starts_at', 'Hanya transaksi gabungan yang masih aktif yang bisa diedit.');
            }

            if ($rental->returnRecord !== null) {
                $validator->errors()->add('starts_at', 'Transaksi gabungan yang sudah dikembalikan tidak bisa diedit.');
            }

            if ($rental->latestExtension !== null) {
                $validator->errors()->add('starts_at', 'Transaksi gabungan yang sudah diperpanjang belum bisa diedit.');
            }

            if ($rental->payments->count() > 1) {
                $validator->errors()->add('paid_amount', 'Transaksi gabungan dengan pembayaran lanjutan belum bisa diedit.');
            }

            $unitIds = collect($this->input('inventory_unit_ids', []))
                ->filter(fn (mixed $value) => filled($value))
                ->map(fn (mixed $value) => (int) $value)
                ->values();

            $saleItems = collect($this->input('sale_items', []))
                ->filter(fn (mixed $item) => is_array($item) && filled($item['sale_product_id'] ?? null))
                ->values();

            if ($unitIds->isEmpty() || $saleItems->isEmpty()) {
                return;
            }

            $currentUnitIds = $rental->items->pluck('inventory_unit_id')->filter()->map(fn ($id) => (int) $id)->values()->all();

            $inventoryUnits = InventoryUnit::query()
                ->with('product:id,name,active,daily_rate')
                ->whereIn('id', $unitIds)
                ->get();

            $unavailableUnits = $inventoryUnits
                ->filter(function (InventoryUnit $inventoryUnit) use ($currentUnitIds): bool {
                    if (in_array($inventoryUnit->id, $currentUnitIds, true)) {
                        return false;
                    }

                    return ! in_array($inventoryUnit->status, [
                        InventoryUnitStatuses::READY_CLEAN,
                        InventoryUnitStatuses::READY_UNCLEAN,
                    ], true);
                })
                ->pluck('unit_code')
                ->all();

            if ($unavailableUnits !== []) {
                $validator->errors()->add(
                    'inventory_unit_ids',
                    'Unit inventaris berikut sudah tidak ready untuk transaksi gabungan: '.implode(', ', $unavailableUnits).'.',
                );
            }

            $inactiveRentalProducts = $inventoryUnits
                ->filter(fn (InventoryUnit $inventoryUnit) => ! in_array($inventoryUnit->id, $currentUnitIds, true) && ! (bool) $inventoryUnit->product?->active)
                ->pluck('product.name')
                ->filter()
                ->unique()
                ->values()
                ->all();

            if ($inactiveRentalProducts !== []) {
                $validator->errors()->add(
                    'inventory_unit_ids',
                    'Produk sewa nonaktif tidak bisa dipakai: '.implode(', ', $inactiveRentalProducts).'.',
                );
            }

            $currentSaleQuantities = $sale->items
                ->groupBy('sale_product_id')
                ->map(fn (Collection $items) => (int) $items->sum('qty'));

            $saleProducts = SaleProduct::query()
                ->whereIn('id', $saleItems->pluck('sale_product_id')->map(fn (mixed $id) => (int) $id)->all())
                ->get()
                ->keyBy('id');

            foreach ($saleItems as $index => $item) {
                $saleProduct = $saleProducts->get((int) $item['sale_product_id']);

                if (! $saleProduct) {
                    continue;
                }

                if (! $saleProduct->active) {
                    $validator->errors()->add("sale_items.$index.sale_product_id", sprintf('Produk "%s" sedang nonaktif.', $saleProduct->name));
                }

                $availableStockForEdit = (int) $saleProduct->stock_qty + (int) ($currentSaleQuantities->get($saleProduct->id) ?? 0);

                if ((int) $item['qty'] > $availableStockForEdit) {
                    $validator->errors()->add("sale_items.$index.qty", sprintf('Stok "%s" tidak cukup. Maksimal %d untuk edit transaksi ini.', $saleProduct->name, $availableStockForEdit));
                }
            }

            if ($validator->errors()->hasAny(['starts_at', 'due_at', 'rental_days', 'inventory_unit_ids', 'sale_items', 'payment_method_config_id', 'paid_amount'])) {
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
            $rentalSubtotal = round(
                $inventoryUnits->sum(fn (InventoryUnit $inventoryUnit) => ((float) $inventoryUnit->product?->daily_rate) * $totalDays),
                2,
            );
            $saleSubtotal = round($this->calculateSaleSubtotal($saleItems, $saleProducts), 2);
            $grandTotal = round($rentalSubtotal + $saleSubtotal, 2);
            $paidAmount = round((float) $this->input('paid_amount', 0), 2);

            if ($paidAmount > $grandTotal) {
                $validator->errors()->add('paid_amount', 'Pembayaran tidak boleh melebihi total transaksi gabungan.');
            }

            if ($paidAmount < $saleSubtotal) {
                $validator->errors()->add('paid_amount', 'Pembayaran minimal harus menutup total barang jual karena item jual langsung selesai saat transaksi dibuat.');
            }

            $paymentMethodConfig = PaymentMethodConfig::query()->find((int) $this->input('payment_method_config_id'));

            if (! $paymentMethodConfig?->active) {
                $validator->errors()->add('payment_method_config_id', 'Metode pembayaran yang dipilih tidak aktif.');
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
                ? min($rentalSubtotal, (float) $seasonRule->dp_value)
                : min($rentalSubtotal, round($rentalSubtotal * ((float) $seasonRule->dp_value / 100), 2));

            $allocatedRentalPayment = round(max(0, $paidAmount - $saleSubtotal), 2);

            if ($allocatedRentalPayment < $requiredDp && blank($this->input('dp_override_reason'))) {
                $validator->errors()->add(
                    'dp_override_reason',
                    'Tanggal sewa masuk season dengan DP rekomendasi '.number_format($requiredDp, 0, ',', '.').'. Isi alasan override jika ingin tetap lanjut.',
                );
            }
        });
    }

    private function calculateSaleSubtotal(Collection $saleItems, Collection $saleProducts): float
    {
        return (float) $saleItems->sum(function (array $item) use ($saleProducts) {
            $saleProduct = $saleProducts->get((int) $item['sale_product_id']);

            return ((float) $saleProduct?->selling_price) * ((int) ($item['qty'] ?? 0));
        });
    }
}
