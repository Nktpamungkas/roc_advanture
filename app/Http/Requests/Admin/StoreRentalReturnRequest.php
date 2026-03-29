<?php

namespace App\Http\Requests\Admin;

use App\Models\Rental;
use App\Services\AdminAccessService;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\RentalStatuses;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreRentalReturnRequest extends FormRequest
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
            'rental_id' => ['required', 'integer', 'exists:rentals,id'],
            'returned_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.rental_item_id' => ['required', 'integer', 'distinct', 'exists:rental_items,id'],
            'items.*.next_unit_status' => [
                'required',
                'string',
                Rule::in([
                    InventoryUnitStatuses::READY_UNCLEAN,
                    InventoryUnitStatuses::READY_CLEAN,
                    InventoryUnitStatuses::MAINTENANCE,
                    InventoryUnitStatuses::RETIRED,
                ]),
            ],
            'items.*.notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $rentalId = $this->integer('rental_id');
            if ($rentalId === 0) {
                return;
            }

            $rental = Rental::query()
                ->with(['items:id,rental_id', 'returnRecord'])
                ->find($rentalId);

            if ($rental === null) {
                return;
            }

            if (! in_array($rental->rental_status, [
                RentalStatuses::PICKED_UP,
                RentalStatuses::LATE,
            ], true)) {
                $validator->errors()->add('rental_id', 'Transaksi ini tidak dalam status aktif untuk diproses pengembaliannya.');
            }

            if ($rental->returnRecord !== null) {
                $validator->errors()->add('rental_id', 'Transaksi ini sudah pernah diproses pengembaliannya.');
            }

            $itemIds = collect($this->input('items', []))
                ->pluck('rental_item_id')
                ->filter(fn (mixed $value) => filled($value))
                ->map(fn (mixed $value) => (int) $value)
                ->values();

            if ($itemIds->count() !== $rental->items->count()) {
                $validator->errors()->add('items', 'Semua item dalam transaksi harus diproses saat pengembalian.');
            }

            $invalidItemIds = $itemIds->diff($rental->items->pluck('id'))->all();
            if ($invalidItemIds !== []) {
                $validator->errors()->add('items', 'Ada item pengembalian yang tidak cocok dengan transaksi yang dipilih.');
            }

            if ($this->filled('returned_at') && $rental->starts_at !== null) {
                $returnedAt = Carbon::parse((string) $this->input('returned_at'));

                if ($returnedAt->lt($rental->starts_at)) {
                    $validator->errors()->add('returned_at', 'Waktu pengembalian tidak boleh lebih awal dari waktu mulai sewa.');
                }
            }

            collect($this->input('items', []))
                ->each(function (array $item, int $index) use ($validator): void {
                    $nextStatus = $item['next_unit_status'] ?? null;
                    $notes = trim((string) ($item['notes'] ?? ''));

                    if (in_array($nextStatus, [InventoryUnitStatuses::MAINTENANCE, InventoryUnitStatuses::RETIRED], true) && $notes === '') {
                        $validator->errors()->add("items.$index.notes", 'Catatan wajib diisi jika status lanjutan maintenance atau retired.');
                    }
                });
        });
    }
}
