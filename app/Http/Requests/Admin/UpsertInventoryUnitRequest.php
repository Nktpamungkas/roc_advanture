<?php

namespace App\Http\Requests\Admin;

use App\Models\InventoryUnit;
use App\Services\AdminAccessService;
use App\Support\Rental\InventoryUnitStatuses;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertInventoryUnitRequest extends FormRequest
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
        /** @var InventoryUnit|null $inventoryUnit */
        $inventoryUnit = $this->route('inventoryUnit');

        return [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'unit_code' => [
                'required',
                'string',
                'max:100',
                Rule::unique('inventory_units', 'unit_code')->ignore($inventoryUnit?->id),
            ],
            'status' => ['required', 'string', Rule::in(InventoryUnitStatuses::all())],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
