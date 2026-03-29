<?php

namespace App\Http\Requests\Admin;

use App\Models\SaleProduct;
use App\Services\AdminAccessService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertSaleProductRequest extends FormRequest
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
        /** @var SaleProduct|null $saleProduct */
        $saleProduct = $this->route('saleProduct');

        return [
            'sku' => [
                'required',
                'string',
                'max:100',
                'regex:/^[A-Z0-9-]+$/',
                Rule::unique('sale_products', 'sku')->ignore($saleProduct?->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:100'],
            'purchase_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'min_stock_qty' => ['required', 'integer', 'min:0'],
            'active' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $sku = strtoupper(trim((string) $this->input('sku', '')));
        $sku = preg_replace('/[^A-Z0-9-]/', '', $sku) ?? '';

        $this->merge([
            'sku' => $sku,
        ]);
    }
}
