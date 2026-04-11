<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CombinedOrder;
use App\Models\ManualIncome;
use App\Models\Rental;
use App\Models\Sale;
use App\Services\AdminAccessService;
use App\Support\Finance\ManualIncomeCategories;
use App\Support\Rental\PaymentMethods;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class CombinedReportController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
    ) {
    }

    public function index(Request $request): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $filters = $this->resolveFilters($request);
        $dateFrom = Carbon::parse($filters['date_from'])->startOfDay();
        $dateTo = Carbon::parse($filters['date_to'])->endOfDay();

        $transactions = $this->buildTransactions($filters, $dateFrom, $dateTo);

        if ($filters['transaction_type'] !== 'all') {
            $transactions = $transactions
                ->where('source_type', $filters['transaction_type'])
                ->values();
        }

        $summary = $this->buildSummary($transactions);
        $pagination = $this->paginateCollection($transactions, $filters['per_page']);

        return Inertia::render('admin/reports/combined/index', [
            'combinedReportFilters' => $filters,
            'transactionTypeOptions' => [
                ['value' => 'all', 'label' => 'Semua Transaksi'],
                ['value' => 'combined', 'label' => 'Transaksi Gabungan'],
                ['value' => 'rental', 'label' => 'Penyewaan'],
                ['value' => 'sale', 'label' => 'Penjualan'],
                ['value' => 'manual_income', 'label' => 'Pemasukan Manual'],
            ],
            'reportSummary' => $summary,
            'transactions' => $pagination->items(),
            'transactionPagination' => [
                'current_page' => $pagination->currentPage(),
                'last_page' => $pagination->lastPage(),
                'per_page' => $pagination->perPage(),
                'total' => $pagination->total(),
                'from' => $pagination->firstItem(),
                'to' => $pagination->lastItem(),
            ],
        ]);
    }

    private function resolveFilters(Request $request): array
    {
        $defaultDateFrom = now()->startOfMonth()->toDateString();
        $defaultDateTo = now()->toDateString();
        $dateFrom = $this->normalizeDate((string) $request->input('date_from', $defaultDateFrom)) ?? $defaultDateFrom;
        $dateTo = $this->normalizeDate((string) $request->input('date_to', $defaultDateTo)) ?? $defaultDateTo;
        $transactionType = (string) $request->input('transaction_type', 'all');

        if ($dateTo < $dateFrom) {
            $dateTo = $dateFrom;
        }

        return [
            'search' => trim((string) $request->input('search', '')),
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'transaction_type' => in_array($transactionType, ['all', 'combined', 'rental', 'sale', 'manual_income'], true) ? $transactionType : 'all',
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];
    }

    private function buildTransactions(array $filters, Carbon $dateFrom, Carbon $dateTo): Collection
    {
        $search = $filters['search'];

        $combinedOrders = CombinedOrder::query()
            ->with([
                'creator:id,name',
                'paymentMethodConfig',
                'rentals.items',
                'sales.items',
            ])
            ->whereBetween('ordered_at', [$dateFrom, $dateTo])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($nestedQuery) use ($search): void {
                    $nestedQuery
                        ->where('combined_no', 'like', '%'.$search.'%')
                        ->orWhere('customer_name', 'like', '%'.$search.'%')
                        ->orWhere('customer_phone', 'like', '%'.$search.'%')
                        ->orWhere('notes', 'like', '%'.$search.'%')
                        ->orWhereHas('rentals', function ($rentalQuery) use ($search): void {
                            $rentalQuery
                                ->where('rental_no', 'like', '%'.$search.'%')
                                ->orWhereHas('customer', function ($customerQuery) use ($search): void {
                                    $customerQuery
                                        ->where('name', 'like', '%'.$search.'%')
                                        ->orWhere('phone_whatsapp', 'like', '%'.$search.'%');
                                })
                                ->orWhereHas('items', function ($itemQuery) use ($search): void {
                                    $itemQuery->where('product_name_snapshot', 'like', '%'.$search.'%');
                                });
                        })
                        ->orWhereHas('sales', function ($saleQuery) use ($search): void {
                            $saleQuery
                                ->where('sale_no', 'like', '%'.$search.'%')
                                ->orWhere('customer_name', 'like', '%'.$search.'%')
                                ->orWhere('customer_phone', 'like', '%'.$search.'%')
                                ->orWhereHas('items', function ($itemQuery) use ($search): void {
                                    $itemQuery
                                        ->where('product_name_snapshot', 'like', '%'.$search.'%')
                                        ->orWhere('sku_snapshot', 'like', '%'.$search.'%');
                                });
                        });
                });
            })
            ->latest('ordered_at')
            ->get()
            ->map(fn (CombinedOrder $combinedOrder) => [
                'id' => 'combined-'.$combinedOrder->id,
                'source_type' => 'combined',
                'source_label' => 'Gabungan',
                'reference_no' => $combinedOrder->combined_no,
                'occurred_at' => $combinedOrder->ordered_at?->toIso8601String(),
                'customer_name' => $combinedOrder->customer_name,
                'customer_phone' => $combinedOrder->customer_phone,
                'items_count' => $this->countCombinedItems($combinedOrder),
                'summary' => $this->buildCombinedSummary($combinedOrder),
                'rental_total' => (string) $combinedOrder->rental_total,
                'sale_total' => (string) $combinedOrder->sale_total,
                'total_amount' => (string) $this->combinedTotalAmount($combinedOrder),
                'paid_amount' => (string) $combinedOrder->paid_amount,
                'remaining_amount' => (string) $combinedOrder->remaining_amount,
                'payment_status_label' => $this->combinedPaymentStatusLabel($combinedOrder->payment_status),
                'payment_method_label' => $this->resolvePaymentMethodLabel($combinedOrder->payment_method_name_snapshot, $combinedOrder->payment_method_type_snapshot),
                'admin_name' => $combinedOrder->creator?->name,
                'detail_url' => route('admin.combined-orders.show', $combinedOrder),
            ]);

        $rentalRows = Rental::query()
            ->with(['customer:id,name,phone_whatsapp', 'creator:id,name'])
            ->withCount('items')
            ->whereNull('combined_order_id')
            ->whereBetween('starts_at', [$dateFrom, $dateTo])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($nestedQuery) use ($search): void {
                    $nestedQuery
                        ->where('rental_no', 'like', '%'.$search.'%')
                        ->orWhere('notes', 'like', '%'.$search.'%')
                        ->orWhereHas('customer', function ($customerQuery) use ($search): void {
                            $customerQuery
                                ->where('name', 'like', '%'.$search.'%')
                                ->orWhere('phone_whatsapp', 'like', '%'.$search.'%');
                        })
                        ->orWhereHas('items', function ($itemQuery) use ($search): void {
                            $itemQuery
                                ->where('product_name_snapshot', 'like', '%'.$search.'%')
                                ->orWhere('status_at_checkout', 'like', '%'.$search.'%');
                        });
                });
            })
            ->latest('starts_at')
            ->get()
            ->map(fn (Rental $rental) => [
                'id' => 'rental-'.$rental->id,
                'source_type' => 'rental',
                'source_label' => 'Penyewaan',
                'reference_no' => $rental->rental_no,
                'occurred_at' => $rental->starts_at?->toIso8601String(),
                'customer_name' => $rental->customer?->name,
                'customer_phone' => $rental->customer?->phone_whatsapp,
                'items_count' => $rental->items_count,
                'summary' => sprintf('%d item sewa', (int) $rental->items_count),
                'rental_total' => (string) ($rental->final_subtotal ?? $rental->subtotal),
                'sale_total' => '0',
                'total_amount' => (string) ($rental->final_subtotal ?? $rental->subtotal),
                'paid_amount' => (string) $rental->paid_amount,
                'remaining_amount' => (string) $rental->remaining_amount,
                'payment_status_label' => RentalPaymentStatuses::label($rental->payment_status),
                'payment_method_label' => $this->resolvePaymentMethodLabel($rental->payment_method_name_snapshot, $rental->payment_method_type_snapshot),
                'admin_name' => $rental->creator?->name,
                'detail_url' => route('admin.rentals.show', $rental),
            ]);

        $saleRows = Sale::query()
            ->with(['soldBy:id,name'])
            ->withCount('items')
            ->whereNull('combined_order_id')
            ->whereBetween('sold_at', [$dateFrom, $dateTo])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($nestedQuery) use ($search): void {
                    $nestedQuery
                        ->where('sale_no', 'like', '%'.$search.'%')
                        ->orWhere('customer_name', 'like', '%'.$search.'%')
                        ->orWhere('customer_phone', 'like', '%'.$search.'%')
                        ->orWhereHas('items', function ($itemQuery) use ($search): void {
                            $itemQuery
                                ->where('product_name_snapshot', 'like', '%'.$search.'%')
                                ->orWhere('sku_snapshot', 'like', '%'.$search.'%');
                        });
                });
            })
            ->latest('sold_at')
            ->get()
            ->map(fn (Sale $sale) => [
                'id' => 'sale-'.$sale->id,
                'source_type' => 'sale',
                'source_label' => 'Penjualan',
                'reference_no' => $sale->sale_no,
                'occurred_at' => $sale->sold_at?->toIso8601String(),
                'customer_name' => $sale->customer_name,
                'customer_phone' => $sale->customer_phone,
                'items_count' => $sale->items_count,
                'summary' => sprintf('%d item jual', (int) $sale->items_count),
                'rental_total' => '0',
                'sale_total' => (string) $sale->total_amount,
                'total_amount' => (string) $sale->total_amount,
                'paid_amount' => (string) $sale->total_amount,
                'remaining_amount' => '0',
                'payment_status_label' => 'Lunas',
                'payment_method_label' => $this->resolvePaymentMethodLabel($sale->payment_method_name_snapshot, $sale->payment_method_type_snapshot),
                'admin_name' => $sale->soldBy?->name,
                'detail_url' => route('admin.sales.show', $sale),
            ]);

        $manualIncomeRows = ManualIncome::query()
            ->with('recorder:id,name')
            ->whereBetween('recorded_at', [$dateFrom, $dateTo])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($nestedQuery) use ($search): void {
                    $nestedQuery
                        ->where('income_no', 'like', '%'.$search.'%')
                        ->orWhere('title', 'like', '%'.$search.'%')
                        ->orWhere('notes', 'like', '%'.$search.'%');
                });
            })
            ->latest('recorded_at')
            ->get()
            ->map(fn (ManualIncome $manualIncome) => [
                'id' => 'manual-income-'.$manualIncome->id,
                'source_type' => 'manual_income',
                'source_label' => 'Pemasukan Manual',
                'reference_no' => $manualIncome->income_no,
                'occurred_at' => $manualIncome->recorded_at?->toIso8601String(),
                'customer_name' => null,
                'customer_phone' => null,
                'items_count' => 1,
                'summary' => ManualIncomeCategories::label($manualIncome->category).': '.$manualIncome->title,
                'rental_total' => '0',
                'sale_total' => '0',
                'total_amount' => (string) $manualIncome->amount,
                'paid_amount' => (string) $manualIncome->amount,
                'remaining_amount' => '0',
                'payment_status_label' => 'Lunas',
                'payment_method_label' => 'Manual',
                'admin_name' => $manualIncome->recorder?->name,
                'detail_url' => route('admin.manual-incomes.index', [
                    'search' => $manualIncome->income_no,
                ]),
            ]);

        return $combinedOrders
            ->concat($rentalRows)
            ->concat($saleRows)
            ->concat($manualIncomeRows)
            ->sortByDesc(fn (array $row) => $row['occurred_at'] ?? '')
            ->values();
    }

    private function buildSummary(Collection $transactions): array
    {
        return [
            'transactions_total' => $transactions->count(),
            'combined_total' => $transactions->where('source_type', 'combined')->count(),
            'rental_total' => $transactions->where('source_type', 'rental')->count(),
            'sale_total' => $transactions->where('source_type', 'sale')->count(),
            'manual_income_total' => $transactions->where('source_type', 'manual_income')->count(),
            'grand_total_amount' => $transactions->sum(fn (array $row) => (float) $row['total_amount']),
            'paid_total_amount' => $transactions->sum(fn (array $row) => (float) $row['paid_amount']),
            'remaining_total_amount' => $transactions->sum(fn (array $row) => (float) $row['remaining_amount']),
        ];
    }

    private function countCombinedItems(CombinedOrder $combinedOrder): int
    {
        return $combinedOrder->rentals->sum(fn (Rental $rental) => $rental->items->count())
            + $combinedOrder->sales->sum(fn (Sale $sale) => $sale->items->count());
    }

    private function buildCombinedSummary(CombinedOrder $combinedOrder): string
    {
        $rentalItems = $combinedOrder->rentals->sum(fn (Rental $rental) => $rental->items->count());
        $saleItems = $combinedOrder->sales->sum(fn (Sale $sale) => $sale->items->count());
        $parts = [];

        if ($rentalItems > 0) {
            $parts[] = $rentalItems.' item sewa';
        }

        if ($saleItems > 0) {
            $parts[] = $saleItems.' item jual';
        }

        return $parts !== [] ? implode(' + ', $parts) : '-';
    }

    private function combinedTotalAmount(CombinedOrder $combinedOrder): float
    {
        return round(max(0, (float) $combinedOrder->subtotal - (float) $combinedOrder->discount_amount), 2);
    }

    private function combinedPaymentStatusLabel(?string $status): string
    {
        return match ($status) {
            'paid' => 'Lunas',
            'partial', 'dp_paid' => 'Dibayar Sebagian',
            'unpaid', null, '' => 'Belum Dibayar',
            default => $status,
        };
    }

    private function resolvePaymentMethodLabel(?string $nameSnapshot, ?string $typeSnapshot): string
    {
        return $nameSnapshot !== null && $nameSnapshot !== ''
            ? $nameSnapshot
            : PaymentMethods::label($typeSnapshot);
    }

    private function paginateCollection(Collection $items, int $perPage): LengthAwarePaginator
    {
        $currentPage = LengthAwarePaginator::resolveCurrentPage();
        $currentItems = $items->slice(($currentPage - 1) * $perPage, $perPage)->values();

        return new LengthAwarePaginator(
            $currentItems,
            $items->count(),
            $perPage,
            $currentPage,
            [
                'path' => LengthAwarePaginator::resolveCurrentPath(),
                'pageName' => 'page',
            ],
        );
    }

    private function normalizeDate(string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }
}
