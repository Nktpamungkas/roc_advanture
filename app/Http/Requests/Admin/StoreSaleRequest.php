<?php

namespace App\Http\Requests\Admin;

use App\Models\PaymentMethodConfig;
use App\Models\SaleProduct;
use App\Services\AdminAccessService;
use Illuminate\Foundation\Http\FormRequest;

class StoreSaleRequest extends FormRequest
{
    public function authorize(AdminAccessService $adminAccessService): bool
    {
        return $this->user() !== null && $adminAccessService->canAccessBackOffice($this->user());
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'sold_at' => ['required', 'date'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method_config_id' => ['required', 'integer', 'exists:payment_method_configs,id'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sale_product_id' => ['required', 'integer', 'distinct', 'exists:sale_products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
        ];
    }

    public function after(): array
    {
        return [
            function ($validator): void {
                $paymentMethod = PaymentMethodConfig::query()->find($this->input('payment_method_config_id'));

                if ($paymentMethod !== null && ! $paymentMethod->active) {
                    $validator->errors()->add('payment_method_config_id', 'Metode pembayaran yang dipilih sedang nonaktif.');
                }

                $items = collect($this->input('items', []));
                if ($items->isEmpty()) {
                    return;
                }

                $products = SaleProduct::query()
                    ->whereIn('id', $items->pluck('sale_product_id')->all())
                    ->get()
                    ->keyBy('id');

                $subtotal = $items->sum(function (array $item) use ($products) {
                    $product = $products->get((int) $item['sale_product_id']);

                    return ((float) $product?->selling_price) * ((int) ($item['qty'] ?? 0));
                });

                if ((float) $this->input('discount_amount', 0) > $subtotal) {
                    $validator->errors()->add('discount_amount', 'Diskon tidak boleh melebihi subtotal penjualan.');
                }
            },
        ];
    }
}
