<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\InventoryUnit;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Rental;
use App\Models\RentalItem;
use App\Models\RentalReturn;
use App\Models\ReturnItem;
use App\Services\AdminAccessService;
use App\Support\Rental\CompensationTypes;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentKinds;
use App\Support\Rental\PaymentMethods;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
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
        $now = now();

        $rentalQuery = Rental::query()
            ->with(['customer:id,name,phone_whatsapp', 'creator:id,name'])
            ->withCount('items')
            ->whereBetween('starts_at', [$dateFrom, $dateTo])
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('rental_no', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('customer', function ($customerQuery) use ($filters): void {
                            $customerQuery
                                ->where('name', 'like', '%'.$filters['search'].'%')
                                ->orWhere('phone_whatsapp', 'like', '%'.$filters['search'].'%');
                        });
                });
            })
            ->when($filters['rental_status'] !== '', fn ($query) => $query->where('rental_status', $filters['rental_status']));

        $rentalMetrics = (clone $rentalQuery)
            ->get(['subtotal', 'final_subtotal', 'paid_amount', 'remaining_amount']);

        $paginatedRentals = $rentalQuery
            ->latest('starts_at')
            ->paginate($filters['per_page'])
            ->withQueryString();

        $activeRentalStatuses = [
            RentalStatuses::BOOKED,
            RentalStatuses::PICKED_UP,
            RentalStatuses::LATE,
        ];

        $dueQuery = Rental::query()
            ->with(['customer:id,name,phone_whatsapp'])
            ->withCount('items')
            ->whereIn('rental_status', $activeRentalStatuses)
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('rental_no', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('customer', function ($customerQuery) use ($filters): void {
                            $customerQuery
                                ->where('name', 'like', '%'.$filters['search'].'%')
                                ->orWhere('phone_whatsapp', 'like', '%'.$filters['search'].'%');
                        });
                });
            });

        $dueItems = $this->buildDueItems((clone $dueQuery), $filters['due_scope'], $now);

        $paymentQuery = Payment::query()
            ->with(['rental.customer:id,name,phone_whatsapp', 'receiver:id,name'])
            ->whereBetween('paid_at', [$dateFrom, $dateTo])
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('method_label_snapshot', 'like', '%'.$filters['search'].'%')
                        ->orWhere('notes', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('rental', function ($rentalQuery) use ($filters): void {
                            $rentalQuery
                                ->where('rental_no', 'like', '%'.$filters['search'].'%')
                                ->orWhereHas('customer', function ($customerQuery) use ($filters): void {
                                    $customerQuery
                                        ->where('name', 'like', '%'.$filters['search'].'%')
                                        ->orWhere('phone_whatsapp', 'like', '%'.$filters['search'].'%');
                                });
                        });
                });
            })
            ->latest('paid_at');

        $paymentMetrics = (clone $paymentQuery)->get();
        $recentPayments = $paymentMetrics->take(10)->values();

        $returnQuery = RentalReturn::query()
            ->with(['rental.customer:id,name,phone_whatsapp', 'checker:id,name'])
            ->whereBetween('returned_at', [$dateFrom, $dateTo])
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->whereHas('rental', function ($rentalQuery) use ($filters): void {
                    $rentalQuery
                        ->where('rental_no', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('customer', function ($customerQuery) use ($filters): void {
                            $customerQuery
                                ->where('name', 'like', '%'.$filters['search'].'%')
                                ->orWhere('phone_whatsapp', 'like', '%'.$filters['search'].'%');
                        });
                });
            })
            ->latest('returned_at');

        $returnMetrics = (clone $returnQuery)->get();

        $damageQuery = ReturnItem::query()
            ->with([
                'returnRecord.rental.customer:id,name,phone_whatsapp',
                'rentalItem.inventoryUnit:id,unit_code',
            ])
            ->whereHas('returnRecord', fn ($query) => $query->whereBetween('returned_at', [$dateFrom, $dateTo]))
            ->where(function ($query): void {
                $query
                    ->where('compensation_type', '!=', CompensationTypes::NONE)
                    ->orWhereIn('next_unit_status', [
                        InventoryUnitStatuses::MAINTENANCE,
                        InventoryUnitStatuses::RETIRED,
                    ]);
            })
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('notes', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('returnRecord.rental', function ($rentalQuery) use ($filters): void {
                            $rentalQuery
                                ->where('rental_no', 'like', '%'.$filters['search'].'%')
                                ->orWhereHas('customer', function ($customerQuery) use ($filters): void {
                                    $customerQuery
                                        ->where('name', 'like', '%'.$filters['search'].'%')
                                        ->orWhere('phone_whatsapp', 'like', '%'.$filters['search'].'%');
                                });
                        })
                        ->orWhereHas('rentalItem', function ($rentalItemQuery) use ($filters): void {
                            $rentalItemQuery->where('product_name_snapshot', 'like', '%'.$filters['search'].'%');
                        });
                });
            })
            ->latest('id');

        $damageMetrics = (clone $damageQuery)->get();

        $topProducts = RentalItem::query()
            ->whereHas('rental', fn ($query) => $query->whereBetween('starts_at', [$dateFrom, $dateTo]))
            ->get(['rental_id', 'product_name_snapshot', 'days', 'line_total'])
            ->groupBy('product_name_snapshot')
            ->map(function (Collection $items, string $productName) {
                $rentalCount = $items->pluck('rental_id')->unique()->count();

                return [
                    'product_name' => $productName,
                    'rentals_count' => $rentalCount,
                    'units_rented_count' => $items->count(),
                    'days_total' => $items->sum('days'),
                    'revenue_total' => (float) $items->sum('line_total'),
                ];
            })
            ->sortByDesc('revenue_total')
            ->values();

        $stockProducts = Product::query()
            ->withCount([
                'inventoryUnits as total_units_count',
                'inventoryUnits as ready_clean_units_count' => fn ($query) => $query->where('status', InventoryUnitStatuses::READY_CLEAN),
                'inventoryUnits as ready_unclean_units_count' => fn ($query) => $query->where('status', InventoryUnitStatuses::READY_UNCLEAN),
                'inventoryUnits as rented_units_count' => fn ($query) => $query->where('status', InventoryUnitStatuses::RENTED),
                'inventoryUnits as maintenance_units_count' => fn ($query) => $query->where('status', InventoryUnitStatuses::MAINTENANCE),
                'inventoryUnits as retired_units_count' => fn ($query) => $query->where('status', InventoryUnitStatuses::RETIRED),
            ])
            ->orderBy('name')
            ->get();

        return Inertia::render('admin/reports/index', [
            'reportFilters' => $filters,
            'rentalStatusOptions' => array_map(fn (string $status) => [
                'value' => $status,
                'label' => RentalStatuses::label($status),
            ], RentalStatuses::all()),
            'dueScopeOptions' => [
                ['value' => 'all', 'label' => 'Semua Aktif'],
                ['value' => 'today', 'label' => 'Jatuh Tempo Hari Ini'],
                ['value' => 'tomorrow', 'label' => 'Jatuh Tempo Besok'],
                ['value' => 'overdue', 'label' => 'Sudah Terlambat'],
                ['value' => 'next_7_days', 'label' => '7 Hari Ke Depan'],
            ],
            'exportTargets' => [
                ['value' => 'rentals', 'label' => 'Penyewaan'],
                ['value' => 'returns', 'label' => 'Pengembalian'],
                ['value' => 'damages', 'label' => 'Kerusakan & Ganti Rugi'],
                ['value' => 'top-products', 'label' => 'Produk Paling Laku'],
            ],
            'reportSummary' => [
                'rentals_in_period' => $paginatedRentals->total(),
                'billed_in_period' => $rentalMetrics->sum(fn (Rental $rental) => (float) ($rental->final_subtotal ?? $rental->subtotal)),
                'payments_in_period' => $paymentMetrics->sum(fn (Payment $payment) => (float) $payment->amount),
                'active_outstanding' => (float) Rental::query()
                    ->whereIn('rental_status', $activeRentalStatuses)
                    ->sum('remaining_amount'),
                'overdue_count' => (clone $dueQuery)->where('due_at', '<', $now)->count(),
                'due_today_count' => (clone $dueQuery)->whereBetween('due_at', [$now->copy()->startOfDay(), $now->copy()->endOfDay()])->count(),
            ],
            'inventorySummary' => [
                'ready_clean' => InventoryUnit::query()->where('status', InventoryUnitStatuses::READY_CLEAN)->count(),
                'ready_unclean' => InventoryUnit::query()->where('status', InventoryUnitStatuses::READY_UNCLEAN)->count(),
                'rented' => InventoryUnit::query()->where('status', InventoryUnitStatuses::RENTED)->count(),
                'maintenance' => InventoryUnit::query()->where('status', InventoryUnitStatuses::MAINTENANCE)->count(),
            ],
            'rentals' => $paginatedRentals->getCollection()
                ->map(fn (Rental $rental) => [
                    'id' => $rental->id,
                    'rental_no' => $rental->rental_no,
                    'customer_name' => $rental->customer?->name,
                    'customer_phone' => $rental->customer?->phone_whatsapp,
                    'starts_at' => $rental->starts_at?->toIso8601String(),
                    'due_at' => $rental->due_at?->toIso8601String(),
                    'items_count' => $rental->items_count,
                    'total_amount' => (string) ($rental->final_subtotal ?? $rental->subtotal),
                    'paid_amount' => (string) $rental->paid_amount,
                    'remaining_amount' => (string) $rental->remaining_amount,
                    'payment_status_label' => RentalPaymentStatuses::label($rental->payment_status),
                    'rental_status_label' => RentalStatuses::label($rental->rental_status),
                    'admin_name' => $rental->creator?->name,
                    'is_overdue' => $rental->due_at !== null && $rental->due_at->lt($now) && in_array($rental->rental_status, $activeRentalStatuses, true),
                ])
                ->values(),
            'rentalPagination' => [
                'current_page' => $paginatedRentals->currentPage(),
                'last_page' => $paginatedRentals->lastPage(),
                'per_page' => $paginatedRentals->perPage(),
                'total' => $paginatedRentals->total(),
                'from' => $paginatedRentals->firstItem(),
                'to' => $paginatedRentals->lastItem(),
            ],
            'dueSummary' => [
                'active_rentals' => (clone $dueQuery)->count(),
                'due_today' => (clone $dueQuery)->whereBetween('due_at', [$now->copy()->startOfDay(), $now->copy()->endOfDay()])->count(),
                'due_tomorrow' => (clone $dueQuery)->whereBetween('due_at', [$now->copy()->addDay()->startOfDay(), $now->copy()->addDay()->endOfDay()])->count(),
                'overdue' => (clone $dueQuery)->where('due_at', '<', $now)->count(),
                'shown_items' => $dueItems->count(),
            ],
            'dueItems' => $dueItems,
            'stockReport' => $stockProducts
                ->map(fn (Product $product) => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'category' => $product->category,
                    'daily_rate' => (string) $product->daily_rate,
                    'total_units_count' => $product->total_units_count,
                    'ready_clean_units_count' => $product->ready_clean_units_count,
                    'ready_unclean_units_count' => $product->ready_unclean_units_count,
                    'rented_units_count' => $product->rented_units_count,
                    'maintenance_units_count' => $product->maintenance_units_count,
                    'retired_units_count' => $product->retired_units_count,
                ])
                ->values(),
            'paymentSummary' => [
                'total_received' => $paymentMetrics->sum(fn (Payment $payment) => (float) $payment->amount),
                'dp_received' => $paymentMetrics->where('payment_kind', PaymentKinds::DP)->sum(fn (Payment $payment) => (float) $payment->amount),
                'settlement_received' => $paymentMetrics->where('payment_kind', PaymentKinds::SETTLEMENT)->sum(fn (Payment $payment) => (float) $payment->amount),
                'compensation_received' => $paymentMetrics->where('payment_kind', PaymentKinds::COMPENSATION)->sum(fn (Payment $payment) => (float) $payment->amount),
                'method_breakdown' => $paymentMetrics
                    ->groupBy(fn (Payment $payment) => $payment->method_label_snapshot ?: PaymentMethods::label($payment->method))
                    ->map(fn (Collection $payments, string $label) => [
                        'label' => $label,
                        'total' => $payments->sum(fn (Payment $payment) => (float) $payment->amount),
                    ])
                    ->values()
                    ->all(),
            ],
            'recentPayments' => $recentPayments
                ->map(fn (Payment $payment) => [
                    'id' => $payment->id,
                    'rental_no' => $payment->rental?->rental_no,
                    'customer_name' => $payment->rental?->customer?->name,
                    'payment_kind_label' => $this->paymentKindLabel($payment->payment_kind),
                    'method_label' => $payment->method_label_snapshot ?: PaymentMethods::label($payment->method),
                    'paid_at' => $payment->paid_at?->toIso8601String(),
                    'amount' => (string) $payment->amount,
                    'receiver_name' => $payment->receiver?->name,
                    'notes' => $payment->notes,
                ])
                ->values(),
            'returnSummary' => [
                'returned_count' => $returnMetrics->count(),
                'settlement_total' => $returnMetrics->sum(fn (RentalReturn $return) => (float) $return->settlement_amount),
                'contract_basis_count' => $returnMetrics->where('charge_basis', 'contract')->count(),
                'actual_basis_count' => $returnMetrics->where('charge_basis', 'actual')->count(),
            ],
            'returnItems' => $returnMetrics
                ->take(10)
                ->map(fn (RentalReturn $return) => [
                    'id' => $return->id,
                    'rental_id' => $return->rental_id,
                    'rental_no' => $return->rental?->rental_no,
                    'customer_name' => $return->rental?->customer?->name,
                    'returned_at' => $return->returned_at?->toIso8601String(),
                    'final_total_days' => $return->final_total_days,
                    'final_subtotal' => (string) $return->final_subtotal,
                    'settlement_amount' => (string) $return->settlement_amount,
                    'charge_basis_label' => $return->charge_basis === 'actual' ? 'Aktual Kembali' : 'Sesuai Kontrak',
                    'checker_name' => $return->checker?->name,
                    'notes' => $return->notes,
                ])
                ->values(),
            'damageSummary' => [
                'cases_count' => $damageMetrics->count(),
                'replacement_count' => $damageMetrics->where('compensation_type', CompensationTypes::REPLACE_WITH_NEW_UNIT)->count(),
                'cash_compensation_count' => $damageMetrics->where('compensation_type', CompensationTypes::CASH_COMPENSATION)->count(),
                'total_compensation' => $damageMetrics->sum(fn (ReturnItem $returnItem) => (float) $returnItem->compensation_amount),
            ],
            'damageItems' => $damageMetrics
                ->take(10)
                ->map(fn (ReturnItem $returnItem) => [
                    'id' => $returnItem->id,
                    'rental_id' => $returnItem->returnRecord?->rental_id,
                    'rental_no' => $returnItem->returnRecord?->rental?->rental_no,
                    'customer_name' => $returnItem->returnRecord?->rental?->customer?->name,
                    'returned_at' => $returnItem->returnRecord?->returned_at?->toIso8601String(),
                    'product_name' => $returnItem->rentalItem?->product_name_snapshot,
                    'unit_code' => $returnItem->rentalItem?->inventoryUnit?->unit_code,
                    'next_unit_status_label' => $returnItem->next_unit_status !== null ? InventoryUnitStatuses::label($returnItem->next_unit_status) : '-',
                    'compensation_type_label' => $this->compensationTypeLabel($returnItem->compensation_type),
                    'compensation_amount' => (string) $returnItem->compensation_amount,
                    'notes' => $returnItem->notes,
                ])
                ->values(),
            'topProductSummary' => [
                'total_product_rows' => $topProducts->count(),
                'top_revenue' => (float) ($topProducts->first()['revenue_total'] ?? 0),
                'top_product_name' => $topProducts->first()['product_name'] ?? null,
            ],
            'topProducts' => $topProducts
                ->take(10)
                ->values(),
        ]);
    }

    public function export(Request $request, string $report): StreamedResponse
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $filters = $this->resolveFilters($request);
        $dateFrom = Carbon::parse($filters['date_from'])->startOfDay();
        $dateTo = Carbon::parse($filters['date_to'])->endOfDay();
        $format = in_array((string) $request->input('format', 'csv'), ['csv', 'excel'], true)
            ? (string) $request->input('format', 'csv')
            : 'csv';

        [$headers, $rows, $filenamePrefix] = match ($report) {
            'rentals' => $this->buildRentalExportRows($filters, $dateFrom, $dateTo),
            'returns' => $this->buildReturnExportRows($filters, $dateFrom, $dateTo),
            'damages' => $this->buildDamageExportRows($filters, $dateFrom, $dateTo),
            'top-products' => $this->buildTopProductExportRows($dateFrom, $dateTo),
            default => abort(404),
        };

        return $this->streamExport(
            $headers,
            $rows,
            sprintf('%s-%s-to-%s.%s', $filenamePrefix, $filters['date_from'], $filters['date_to'], $format === 'csv' ? 'csv' : 'xls'),
            $format,
        );
    }

    private function resolveFilters(Request $request): array
    {
        $defaultDateFrom = now()->startOfMonth()->toDateString();
        $defaultDateTo = now()->toDateString();
        $dueScope = (string) $request->input('due_scope', 'all');
        $dateFrom = $this->normalizeDate((string) $request->input('date_from', $defaultDateFrom)) ?? $defaultDateFrom;
        $dateTo = $this->normalizeDate((string) $request->input('date_to', $defaultDateTo)) ?? $defaultDateTo;

        if ($dateTo < $dateFrom) {
            $dateTo = $dateFrom;
        }

        return [
            'search' => trim((string) $request->input('search', '')),
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'rental_status' => in_array((string) $request->input('rental_status', ''), RentalStatuses::all(), true)
                ? (string) $request->input('rental_status', '')
                : '',
            'due_scope' => in_array($dueScope, ['all', 'today', 'tomorrow', 'overdue', 'next_7_days'], true) ? $dueScope : 'all',
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];
    }

    private function buildDueItems($query, string $dueScope, Carbon $now): Collection
    {
        $filteredQuery = match ($dueScope) {
            'today' => $query->whereBetween('due_at', [$now->copy()->startOfDay(), $now->copy()->endOfDay()]),
            'tomorrow' => $query->whereBetween('due_at', [$now->copy()->addDay()->startOfDay(), $now->copy()->addDay()->endOfDay()]),
            'overdue' => $query->where('due_at', '<', $now),
            'next_7_days' => $query->whereBetween('due_at', [$now, $now->copy()->addDays(7)->endOfDay()]),
            default => $query,
        };

        return $filteredQuery
            ->orderBy('due_at')
            ->limit(12)
            ->get()
            ->map(function (Rental $rental) use ($now) {
                $dueAt = $rental->due_at;
                $dueLabel = '-';

                if ($dueAt !== null) {
                    if ($dueAt->lt($now)) {
                        $dueLabel = 'Telat '.$dueAt->diffInDays($now).' hari';
                    } elseif ($dueAt->isToday()) {
                        $dueLabel = 'Jatuh tempo hari ini';
                    } elseif ($dueAt->isTomorrow()) {
                        $dueLabel = 'Jatuh tempo besok';
                    } else {
                        $dueLabel = $now->copy()->startOfDay()->diffInDays($dueAt->copy()->startOfDay()).' hari lagi';
                    }
                }

                return [
                    'id' => $rental->id,
                    'rental_no' => $rental->rental_no,
                    'customer_name' => $rental->customer?->name,
                    'customer_phone' => $rental->customer?->phone_whatsapp,
                    'due_at' => $dueAt?->toIso8601String(),
                    'items_count' => $rental->items_count,
                    'remaining_amount' => (string) $rental->remaining_amount,
                    'rental_status_label' => RentalStatuses::label($rental->rental_status),
                    'due_label' => $dueLabel,
                    'is_overdue' => $dueAt !== null && $dueAt->lt($now),
                ];
            })
            ->values();
    }

    private function buildRentalExportRows(array $filters, Carbon $dateFrom, Carbon $dateTo): array
    {
        $rows = Rental::query()
            ->with(['customer:id,name,phone_whatsapp', 'creator:id,name'])
            ->withCount('items')
            ->whereBetween('starts_at', [$dateFrom, $dateTo])
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('rental_no', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('customer', function ($customerQuery) use ($filters): void {
                            $customerQuery
                                ->where('name', 'like', '%'.$filters['search'].'%')
                                ->orWhere('phone_whatsapp', 'like', '%'.$filters['search'].'%');
                        });
                });
            })
            ->when($filters['rental_status'] !== '', fn ($query) => $query->where('rental_status', $filters['rental_status']))
            ->latest('starts_at')
            ->get()
            ->map(fn (Rental $rental) => [
                $rental->rental_no,
                $rental->customer?->name ?? '-',
                $rental->customer?->phone_whatsapp ?? '-',
                $rental->starts_at?->format('Y-m-d H:i') ?? '-',
                $rental->due_at?->format('Y-m-d H:i') ?? '-',
                $rental->items_count,
                (float) ($rental->final_subtotal ?? $rental->subtotal),
                (float) $rental->paid_amount,
                (float) $rental->remaining_amount,
                RentalPaymentStatuses::label($rental->payment_status),
                RentalStatuses::label($rental->rental_status),
                $rental->creator?->name ?? '-',
            ])
            ->all();

        return [[
            'No Rental',
            'Customer',
            'No WhatsApp',
            'Mulai Sewa',
            'Harus Kembali',
            'Jumlah Item',
            'Total',
            'Dibayar',
            'Sisa',
            'Status Bayar',
            'Status Rental',
            'Admin',
        ], $rows, 'laporan-penyewaan'];
    }

    private function buildReturnExportRows(array $filters, Carbon $dateFrom, Carbon $dateTo): array
    {
        $rows = RentalReturn::query()
            ->with(['rental.customer:id,name,phone_whatsapp', 'checker:id,name'])
            ->whereBetween('returned_at', [$dateFrom, $dateTo])
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->whereHas('rental', function ($rentalQuery) use ($filters): void {
                    $rentalQuery
                        ->where('rental_no', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('customer', function ($customerQuery) use ($filters): void {
                            $customerQuery
                                ->where('name', 'like', '%'.$filters['search'].'%')
                                ->orWhere('phone_whatsapp', 'like', '%'.$filters['search'].'%');
                        });
                });
            })
            ->latest('returned_at')
            ->get()
            ->map(fn (RentalReturn $return) => [
                $return->rental?->rental_no ?? '-',
                $return->rental?->customer?->name ?? '-',
                $return->returned_at?->format('Y-m-d H:i') ?? '-',
                $return->charge_basis === 'actual' ? 'Aktual Kembali' : 'Sesuai Kontrak',
                $return->final_total_days,
                (float) $return->final_subtotal,
                (float) $return->settlement_amount,
                $return->checker?->name ?? '-',
                $return->notes ?? '',
            ])
            ->all();

        return [[
            'No Rental',
            'Customer',
            'Waktu Kembali',
            'Basis Tagihan',
            'Durasi Final',
            'Subtotal Final',
            'Pelunasan Saat Return',
            'Dicek Oleh',
            'Catatan',
        ], $rows, 'laporan-pengembalian'];
    }

    private function buildDamageExportRows(array $filters, Carbon $dateFrom, Carbon $dateTo): array
    {
        $rows = ReturnItem::query()
            ->with([
                'returnRecord.rental.customer:id,name,phone_whatsapp',
                'rentalItem.inventoryUnit:id,unit_code',
            ])
            ->whereHas('returnRecord', fn ($query) => $query->whereBetween('returned_at', [$dateFrom, $dateTo]))
            ->where(function ($query): void {
                $query
                    ->where('compensation_type', '!=', CompensationTypes::NONE)
                    ->orWhereIn('next_unit_status', [
                        InventoryUnitStatuses::MAINTENANCE,
                        InventoryUnitStatuses::RETIRED,
                    ]);
            })
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('notes', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('returnRecord.rental', function ($rentalQuery) use ($filters): void {
                            $rentalQuery
                                ->where('rental_no', 'like', '%'.$filters['search'].'%')
                                ->orWhereHas('customer', function ($customerQuery) use ($filters): void {
                                    $customerQuery
                                        ->where('name', 'like', '%'.$filters['search'].'%')
                                        ->orWhere('phone_whatsapp', 'like', '%'.$filters['search'].'%');
                                });
                        })
                        ->orWhereHas('rentalItem', function ($rentalItemQuery) use ($filters): void {
                            $rentalItemQuery->where('product_name_snapshot', 'like', '%'.$filters['search'].'%');
                        });
                });
            })
            ->latest('id')
            ->get()
            ->map(fn (ReturnItem $returnItem) => [
                $returnItem->returnRecord?->rental?->rental_no ?? '-',
                $returnItem->returnRecord?->rental?->customer?->name ?? '-',
                $returnItem->returnRecord?->returned_at?->format('Y-m-d H:i') ?? '-',
                $returnItem->rentalItem?->product_name_snapshot ?? '-',
                $returnItem->rentalItem?->inventoryUnit?->unit_code ?? '-',
                $this->compensationTypeLabel($returnItem->compensation_type),
                $returnItem->next_unit_status !== null ? InventoryUnitStatuses::label($returnItem->next_unit_status) : '-',
                (float) $returnItem->compensation_amount,
                $returnItem->notes ?? '',
            ])
            ->all();

        return [[
            'No Rental',
            'Customer',
            'Waktu Return',
            'Produk',
            'Unit',
            'Jenis Penyelesaian',
            'Status Unit Berikutnya',
            'Nominal Ganti Rugi',
            'Catatan',
        ], $rows, 'laporan-kerusakan-ganti-rugi'];
    }

    private function buildTopProductExportRows(Carbon $dateFrom, Carbon $dateTo): array
    {
        $rows = RentalItem::query()
            ->whereHas('rental', fn ($query) => $query->whereBetween('starts_at', [$dateFrom, $dateTo]))
            ->get(['rental_id', 'product_name_snapshot', 'days', 'line_total'])
            ->groupBy('product_name_snapshot')
            ->map(function (Collection $items, string $productName) {
                return [
                    $productName,
                    $items->pluck('rental_id')->unique()->count(),
                    $items->count(),
                    $items->sum('days'),
                    (float) $items->sum('line_total'),
                ];
            })
            ->sortByDesc(fn (array $row) => $row[4])
            ->values()
            ->all();

        return [[
            'Produk',
            'Total Rental',
            'Total Unit Keluar',
            'Total Hari Tersewa',
            'Omzet',
        ], $rows, 'laporan-produk-paling-laku'];
    }

    private function streamExport(array $headers, array $rows, string $filename, string $format): StreamedResponse
    {
        $separator = $format === 'csv' ? ',' : "\t";
        $contentType = $format === 'csv'
            ? 'text/csv; charset=UTF-8'
            : 'application/vnd.ms-excel; charset=UTF-8';

        return response()->streamDownload(function () use ($headers, $rows, $separator, $format): void {
            $handle = fopen('php://output', 'wb');

            if ($handle === false) {
                return;
            }

            fwrite($handle, "\xEF\xBB\xBF");

            if ($format === 'csv') {
                fputcsv($handle, $headers, $separator);

                foreach ($rows as $row) {
                    fputcsv($handle, $this->normalizeExportRow($row), $separator);
                }
            } else {
                fwrite($handle, implode($separator, array_map(fn (string $value) => $this->escapeExportValue($value), $headers)).PHP_EOL);

                foreach ($rows as $row) {
                    fwrite($handle, implode($separator, array_map(fn (string $value) => $this->escapeExportValue($value), $this->normalizeExportRow($row))).PHP_EOL);
                }
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => $contentType,
        ]);
    }

    private function normalizeExportRow(array $row): array
    {
        return array_map(function ($value): string {
            if (is_bool($value)) {
                return $value ? 'Ya' : 'Tidak';
            }

            return (string) $value;
        }, $row);
    }

    private function escapeExportValue(string $value): string
    {
        return str_replace(["\r", "\n", "\t"], [' ', ' ', ' '], $value);
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

    private function paymentKindLabel(?string $kind): string
    {
        return match ($kind) {
            PaymentKinds::DP => 'DP',
            PaymentKinds::SETTLEMENT => 'Pelunasan',
            PaymentKinds::COMPENSATION => 'Ganti Rugi',
            default => $kind ?? '-',
        };
    }

    private function compensationTypeLabel(?string $type): string
    {
        return match ($type) {
            CompensationTypes::REPLACE_WITH_NEW_UNIT => 'Ganti Barang Baru',
            CompensationTypes::CASH_COMPENSATION => 'Ganti Rugi Uang',
            CompensationTypes::NONE => 'Tanpa Ganti Rugi',
            default => $type ?? '-',
        };
    }
}
