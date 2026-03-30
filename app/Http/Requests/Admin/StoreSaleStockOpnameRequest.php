<?php

namespace App\Http\Requests\Admin;

use App\Services\AdminAccessService;
use Illuminate\Foundation\Http\FormRequest;

class StoreSaleStockOpnameRequest extends FormRequest
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
            'performed_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sale_product_id' => ['required', 'integer', 'distinct', 'exists:sale_products,id'],
            'items.*.physical_qty' => ['required', 'integer', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
