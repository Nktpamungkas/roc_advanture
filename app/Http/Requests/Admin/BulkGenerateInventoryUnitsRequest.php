<?php

namespace App\Http\Requests\Admin;

use App\Services\AdminAccessService;
use App\Support\Rental\InventoryUnitStatuses;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkGenerateInventoryUnitsRequest extends FormRequest
{
    protected $errorBag = 'generateInventoryUnits';

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
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:200'],
            'start_number' => ['nullable', 'integer', 'min:1', 'max:999999'],
            'status' => ['required', 'string', Rule::in(InventoryUnitStatuses::all())],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
