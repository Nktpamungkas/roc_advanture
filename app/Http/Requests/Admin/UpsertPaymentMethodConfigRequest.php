<?php

namespace App\Http\Requests\Admin;

use App\Models\PaymentMethodConfig;
use App\Services\AdminAccessService;
use App\Support\Rental\PaymentMethods;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpsertPaymentMethodConfigRequest extends FormRequest
{
    public function authorize(AdminAccessService $adminAccessService): bool
    {
        return $this->user() !== null && $adminAccessService->isSuperAdmin($this->user());
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('code') && $this->filled('name')) {
            $this->merge([
                'code' => Str::slug((string) $this->input('name')),
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var PaymentMethodConfig|null $paymentMethodConfig */
        $paymentMethodConfig = $this->route('paymentMethodConfig');

        return [
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in(PaymentMethods::all())],
            'code' => ['required', 'string', 'max:255', Rule::unique('payment_method_configs', 'code')->ignore($paymentMethodConfig?->id)],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'account_number' => ['nullable', 'string', 'max:255'],
            'account_name' => ['nullable', 'string', 'max:255'],
            'qr_image' => ['nullable', 'file', 'image', 'max:4096'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'active' => ['required', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $type = (string) $this->input('type');
            $existingMethod = $this->route('paymentMethodConfig');

            if ($type === PaymentMethods::TRANSFER) {
                foreach (['bank_name', 'account_number', 'account_name'] as $field) {
                    if (! $this->filled($field)) {
                        $validator->errors()->add($field, 'Kolom ini wajib diisi untuk metode transfer.');
                    }
                }
            }

            $hasExistingQr = $existingMethod instanceof PaymentMethodConfig && filled($existingMethod->qr_image_path);

            if ($type === PaymentMethods::QRIS && ! $hasExistingQr && ! $this->hasFile('qr_image')) {
                $validator->errors()->add('qr_image', 'Gambar QRIS wajib diupload untuk metode QRIS.');
            }
        });
    }

    public function qrImage(): ?UploadedFile
    {
        return $this->file('qr_image');
    }
}
