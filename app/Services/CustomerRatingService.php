<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\ReturnItem;
use App\Models\Rental;
use Illuminate\Support\Collection;

class CustomerRatingService
{
    /**
     * @param  Collection<int, Customer>  $customers
     * @return array<int, array{
     *     score: int,
     *     label: string,
     *     total_rentals: int,
     *     completed_rentals: int,
     *     overdue_returns: int,
     *     damaged_returns: int
     * }>
     */
    public function summarizeMany(Collection $customers): array
    {
        $customerIds = $customers->pluck('id')->all();

        if ($customerIds === []) {
            return [];
        }

        $rentals = Rental::query()
            ->with('returnRecord:id,rental_id,returned_at')
            ->whereIn('customer_id', $customerIds)
            ->get(['id', 'customer_id', 'due_at', 'rental_status']);

        $damagedRentalIds = ReturnItem::query()
            ->whereIn('rental_item_id', function ($query) use ($customerIds): void {
                $query->select('rental_items.id')
                    ->from('rental_items')
                    ->join('rentals', 'rentals.id', '=', 'rental_items.rental_id')
                    ->whereIn('rentals.customer_id', $customerIds);
            })
            ->where('return_condition', 'damaged')
            ->join('rental_items', 'rental_items.id', '=', 'return_items.rental_item_id')
            ->pluck('rental_items.rental_id')
            ->unique()
            ->all();

        $damagedRentalLookup = array_fill_keys($damagedRentalIds, true);

        return $customers->mapWithKeys(function (Customer $customer) use ($rentals, $damagedRentalLookup): array {
            $customerRentals = $rentals->where('customer_id', $customer->id)->values();
            $completedRentals = $customerRentals->filter(fn (Rental $rental) => $rental->returnRecord !== null);
            $overdueReturns = $completedRentals->filter(
                fn (Rental $rental) => $rental->returnRecord?->returned_at !== null
                    && $rental->due_at !== null
                    && $rental->returnRecord->returned_at->gt($rental->due_at),
            )->count();
            $damagedReturns = $completedRentals->filter(fn (Rental $rental) => isset($damagedRentalLookup[$rental->id]))->count();

            $score = 60;
            $score += min(25, $completedRentals->count() * 5);
            $score -= $overdueReturns * 10;
            $score -= $damagedReturns * 15;
            $score = max(0, min(100, $score));

            return [
                $customer->id => [
                    'score' => $score,
                    'label' => $this->labelFromScore($score),
                    'total_rentals' => $customerRentals->count(),
                    'completed_rentals' => $completedRentals->count(),
                    'overdue_returns' => $overdueReturns,
                    'damaged_returns' => $damagedReturns,
                ],
            ];
        })->all();
    }

    public function labelFromScore(int $score): string
    {
        return match (true) {
            $score >= 80 => 'Baik',
            $score >= 60 => 'Cukup',
            default => 'Perlu Perhatian',
        };
    }
}
