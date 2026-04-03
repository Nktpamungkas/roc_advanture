<?php

namespace App\Http\Requests\Admin;

use App\Models\PaymentMethodConfig;
use App\Models\Rental;
use App\Services\AdminAccessService;
use App\Support\Rental\RentalStatuses;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ExtendRentalRequest extends FormRequest
{
    public function authorize(AdminAccessService $adminAccessService): bool
    {
        return $this->user() !== null && $adminAccessService->canAccessBackOffice($this->user());
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'extension_payment_amount' => $this->filled('extension_payment_amount') ? $this->input('extension_payment_amount') : 0,
            'payment_method_config_id' => $this->filled('payment_method_config_id') ? (int) $this->input('payment_method_config_id') : null,
            'payment_notes' => $this->filled('payment_notes') ? trim((string) $this->input('payment_notes')) : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'due_at' => ['required', 'date'],
            'extension_payment_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method_config_id' => ['nullable', 'integer', 'exists:payment_method_configs,id'],
            'payment_notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var Rental|null $rental */
            $rental = $this->route('rental');

            if (! $rental instanceof Rental) {
                $validator->errors()->add('due_at', 'Transaksi rental tidak ditemukan.');

                return;
            }

            if (! in_array($rental->rental_status, [RentalStatuses::PICKED_UP, RentalStatuses::LATE], true)) {
                $validator->errors()->add('due_at', 'Hanya rental aktif yang bisa diperpanjang.');

                return;
            }

            if ($rental->starts_at === null || $rental->due_at === null) {
                $validator->errors()->add('due_at', 'Data jadwal rental belum lengkap.');

                return;
            }

            if ($validator->errors()->hasAny(['due_at', 'extension_payment_amount', 'payment_method_config_id'])) {
                return;
            }

            $newDueAt = Carbon::parse((string) $this->input('due_at'));

            if (! $newDueAt->gt($rental->due_at)) {
                $validator->errors()->add('due_at', 'Tanggal/jam perpanjangan harus lebih besar dari jatuh tempo saat ini.');

                return;
            }

            $newTotalDays = max(1, (int) ceil($rental->starts_at->diffInMinutes($newDueAt) / 1440));
            $newSubtotal = round(
                $rental->items()->sum('daily_rate_snapshot') * $newTotalDays,
                2,
            );
            $newRemainingAmount = round(max(0, $newSubtotal - (float) $rental->paid_amount), 2);
            $extensionPaymentAmount = round((float) $this->input('extension_payment_amount', 0), 2);

            if ($extensionPaymentAmount > $newRemainingAmount) {
                $validator->errors()->add('extension_payment_amount', 'Pembayaran saat perpanjang tidak boleh melebihi sisa tagihan terbaru.');
            }

            if ($extensionPaymentAmount > 0) {
                $paymentMethodConfig = PaymentMethodConfig::query()->find((int) $this->input('payment_method_config_id'));

                if ($paymentMethodConfig === null || ! $paymentMethodConfig->active) {
                    $validator->errors()->add('payment_method_config_id', 'Pilih metode pembayaran aktif untuk mencatat pembayaran perpanjangan.');
                }
            }
        });
    }
}
