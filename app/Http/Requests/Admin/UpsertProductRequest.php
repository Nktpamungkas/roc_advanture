<?php

namespace App\Http\Requests\Admin;

use App\Models\Product;
use App\Services\AdminAccessService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertProductRequest extends FormRequest
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
        /** @var Product|null $product */
        $product = $this->route('product');

        return [
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:100'],
            'prefix_code' => [
                'required',
                'string',
                'max:30',
                'regex:/^[A-Z0-9]+$/',
                Rule::unique('products', 'prefix_code')->ignore($product?->id),
            ],
            'daily_rate' => ['required', 'numeric', 'min:0'],
            'active' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $prefixCode = strtoupper((string) $this->input('prefix_code', ''));
        $prefixCode = preg_replace('/[^A-Z0-9]/', '', $prefixCode) ?? '';

        $this->merge([
            'prefix_code' => $prefixCode,
        ]);
    }
}
