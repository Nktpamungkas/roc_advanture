<?php

namespace App\Http\Requests\Admin;

use App\Services\AdminAccessService;
use App\Support\Rental\InventoryUnitStatuses;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRentalStockOpnameRequest extends FormRequest
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
            'items.*.inventory_unit_id' => ['required', 'integer', 'distinct', 'exists:inventory_units,id'],
            'items.*.observed_status' => ['required', 'string', Rule::in(InventoryUnitStatuses::all())],
            'items.*.notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
