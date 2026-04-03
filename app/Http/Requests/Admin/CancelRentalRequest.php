<?php

namespace App\Http\Requests\Admin;

use App\Models\Rental;
use App\Services\AdminAccessService;
use App\Support\Rental\RentalStatuses;
use Illuminate\Foundation\Http\FormRequest;

class CancelRentalRequest extends FormRequest
{
    public function authorize(AdminAccessService $adminAccessService): bool
    {
        return $this->user() !== null && $adminAccessService->canAccessBackOffice($this->user());
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'cancel_reason' => $this->filled('cancel_reason') ? trim((string) $this->input('cancel_reason')) : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'cancel_reason' => ['required', 'string', 'max:5000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            /** @var Rental|null $rental */
            $rental = $this->route('rental');

            if (! $rental instanceof Rental) {
                $validator->errors()->add('cancel_reason', 'Transaksi rental tidak ditemukan.');

                return;
            }

            if (! in_array($rental->rental_status, [RentalStatuses::BOOKED, RentalStatuses::PICKED_UP, RentalStatuses::LATE], true)) {
                $validator->errors()->add('cancel_reason', 'Hanya rental aktif yang bisa dibatalkan.');
            }
        });
    }
}
