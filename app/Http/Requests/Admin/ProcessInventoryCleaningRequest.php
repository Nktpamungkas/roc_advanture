<?php

namespace App\Http\Requests\Admin;

use App\Models\InventoryUnit;
use App\Services\AdminAccessService;
use App\Support\Rental\InventoryUnitStatuses;
use Illuminate\Foundation\Http\FormRequest;

class ProcessInventoryCleaningRequest extends FormRequest
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
            'unit_ids' => ['required', 'array', 'min:1'],
            'unit_ids.*' => ['required', 'integer', 'distinct', 'exists:inventory_units,id'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $unitIds = collect($this->input('unit_ids', []))
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();

            $units = InventoryUnit::query()
                ->whereIn('id', $unitIds)
                ->get(['id', 'unit_code', 'status']);

            $invalidUnits = $units
                ->filter(fn (InventoryUnit $unit) => $unit->status !== InventoryUnitStatuses::READY_UNCLEAN)
                ->pluck('unit_code')
                ->values();

            if ($invalidUnits->isNotEmpty()) {
                $validator->errors()->add(
                    'unit_ids',
                    'Hanya unit dengan status Ready Belum Dicuci yang bisa diproses. Bentrok pada: '.$invalidUnits->implode(', '),
                );
            }
        });
    }
}
