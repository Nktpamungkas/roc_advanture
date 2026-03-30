<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethodConfig;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleProduct;
use App\Services\AdminAccessService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SalesReportController extends Controller
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

        $salesQuery = $this->buildSalesQuery($filters, $dateFrom, $dateTo)
            ->with(['soldBy:id,name'])
            ->withCount('items');

        $saleMetrics = (clone $salesQuery)->get([
            'subtotal',
            'discount_amount',
            'total_amount',
            'payment_method_name_snapshot',
        ]);

        $paginatedSales = $salesQuery
            ->latest('sold_at')
            ->paginate($filters['per_page'])
            ->withQueryString();

        $topProducts = $this->buildTopProducts($filters, $dateFrom, $dateTo);

        $lowStockProducts = SaleProduct::query()
            ->where('active', true)
            ->whereColumn('stock_qty', '<=', 'min_stock_qty')
            ->orderBy('stock_qty')
            ->orderBy('name')
            ->get();

        $paymentMethodOptions = PaymentMethodConfig::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (PaymentMethodConfig $paymentMethodConfig) => [
                'value' => (string) $paymentMethodConfig->id,
                'label' => $paymentMethodConfig->name,
            ])
            ->values();

        return Inertia::render('admin/reports/sales/index', [
            'salesReportFilters' => $filters,
            'paymentMethodOptions' => $paymentMethodOptions,
            'exportTargets' => [
                ['value' => 'sales', 'label' => 'Transaksi Penjualan'],
                ['value' => 'top-products', 'label' => 'Produk Jual Paling Laku'],
                ['value' => 'low-stock', 'label' => 'Stok Menipis'],
            ],
            'salesSummary' => [
                'transactions_in_period' => $paginatedSales->total(),
                'revenue_in_period' => $saleMetrics->sum(fn (Sale $sale) => (float) $sale->total_amount),
                'discount_in_period' => $saleMetrics->sum(fn (Sale $sale) => (float) $sale->discount_amount),
                'items_sold_in_period' => $topProducts->sum('qty_total'),
                'average_ticket' => $saleMetrics->count() > 0
                    ? (float) ($saleMetrics->sum(fn (Sale $sale) => (float) $sale->total_amount) / $saleMetrics->count())
                    : 0,
                'low_stock_count' => $lowStockProducts->count(),
            ],
            'sales' => $paginatedSales->getCollection()
                ->map(fn (Sale $sale) => [
                    'id' => $sale->id,
                    'sale_no' => $sale->sale_no,
                    'sold_at' => $sale->sold_at?->toIso8601String(),
                    'customer_name' => $sale->customer_name,
                    'customer_phone' => $sale->customer_phone,
                    'items_count' => $sale->items_count,
                    'subtotal' => (string) $sale->subtotal,
                    'discount_amount' => (string) $sale->discount_amount,
                    'total_amount' => (string) $sale->total_amount,
                    'payment_method_name' => $sale->payment_method_name_snapshot,
                    'sold_by_name' => $sale->soldBy?->name,
                ])
                ->values(),
            'salesPagination' => [
                'current_page' => $paginatedSales->currentPage(),
                'last_page' => $paginatedSales->lastPage(),
                'per_page' => $paginatedSales->perPage(),
                'total' => $paginatedSales->total(),
                'from' => $paginatedSales->firstItem(),
                'to' => $paginatedSales->lastItem(),
            ],
            'paymentSummary' => [
                'total_received' => $saleMetrics->sum(fn (Sale $sale) => (float) $sale->total_amount),
                'method_breakdown' => $saleMetrics
                    ->groupBy(fn (Sale $sale) => $sale->payment_method_name_snapshot ?: 'Tanpa Metode')
                    ->map(fn (Collection $sales, string $label) => [
                        'label' => $label,
                        'transactions' => $sales->count(),
                        'total' => $sales->sum(fn (Sale $sale) => (float) $sale->total_amount),
                    ])
                    ->values()
                    ->all(),
            ],
            'topProductSummary' => [
                'total_product_rows' => $topProducts->count(),
                'top_revenue' => (float) ($topProducts->first()['revenue_total'] ?? 0),
                'top_product_name' => $topProducts->first()['display_name'] ?? null,
            ],
            'topProducts' => $topProducts->take(10)->values()->all(),
            'lowStockProducts' => $lowStockProducts
                ->map(fn (SaleProduct $saleProduct) => [
                    'id' => $saleProduct->id,
                    'sku' => $saleProduct->sku,
                    'name' => $saleProduct->name,
                    'category' => $saleProduct->category,
                    'stock_qty' => $saleProduct->stock_qty,
                    'min_stock_qty' => $saleProduct->min_stock_qty,
                    'selling_price' => (string) $saleProduct->selling_price,
                ])
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
            'sales' => $this->buildSalesExportRows($filters, $dateFrom, $dateTo),
            'top-products' => $this->buildTopProductExportRows($filters, $dateFrom, $dateTo),
            'low-stock' => $this->buildLowStockExportRows($filters),
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
        $dateFrom = $this->normalizeDate((string) $request->input('date_from', $defaultDateFrom)) ?? $defaultDateFrom;
        $dateTo = $this->normalizeDate((string) $request->input('date_to', $defaultDateTo)) ?? $defaultDateTo;
        $paymentMethodId = (string) $request->input('payment_method_config_id', '');

        if ($dateTo < $dateFrom) {
            $dateTo = $dateFrom;
        }

        return [
            'search' => trim((string) $request->input('search', '')),
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'payment_method_config_id' => ctype_digit($paymentMethodId) ? $paymentMethodId : '',
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];
    }

    private function buildSalesQuery(array $filters, Carbon $dateFrom, Carbon $dateTo)
    {
        return Sale::query()
            ->whereBetween('sold_at', [$dateFrom, $dateTo])
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('sale_no', 'like', '%'.$filters['search'].'%')
                        ->orWhere('customer_name', 'like', '%'.$filters['search'].'%')
                        ->orWhere('customer_phone', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('items', function ($itemQuery) use ($filters): void {
                            $itemQuery
                                ->where('product_name_snapshot', 'like', '%'.$filters['search'].'%')
                                ->orWhere('sku_snapshot', 'like', '%'.$filters['search'].'%');
                        });
                });
            })
            ->when($filters['payment_method_config_id'] !== '', fn ($query) => $query->where('payment_method_config_id', $filters['payment_method_config_id']));
    }

    private function buildTopProducts(array $filters, Carbon $dateFrom, Carbon $dateTo): Collection
    {
        return SaleItem::query()
            ->whereHas('sale', function ($query) use ($filters, $dateFrom, $dateTo): void {
                $query
                    ->whereBetween('sold_at', [$dateFrom, $dateTo])
                    ->when($filters['search'] !== '', function ($nestedQuery) use ($filters): void {
                        $nestedQuery->where(function ($searchQuery) use ($filters): void {
                            $searchQuery
                                ->where('sale_no', 'like', '%'.$filters['search'].'%')
                                ->orWhere('customer_name', 'like', '%'.$filters['search'].'%')
                                ->orWhere('customer_phone', 'like', '%'.$filters['search'].'%')
                                ->orWhereHas('items', function ($itemQuery) use ($filters): void {
                                    $itemQuery
                                        ->where('product_name_snapshot', 'like', '%'.$filters['search'].'%')
                                        ->orWhere('sku_snapshot', 'like', '%'.$filters['search'].'%');
                                });
                        });
                    })
                    ->when($filters['payment_method_config_id'] !== '', fn ($nestedQuery) => $nestedQuery->where('payment_method_config_id', $filters['payment_method_config_id']));
            })
            ->get(['sale_id', 'product_name_snapshot', 'sku_snapshot', 'qty', 'line_total'])
            ->groupBy(fn (SaleItem $saleItem) => $saleItem->sku_snapshot.'|'.$saleItem->product_name_snapshot)
            ->map(function (Collection $items, string $key) {
                [$sku, $productName] = explode('|', $key, 2);

                return [
                    'display_name' => trim($productName).' ('.trim($sku).')',
                    'product_name' => $productName,
                    'sku' => $sku,
                    'transactions_count' => $items->pluck('sale_id')->unique()->count(),
                    'qty_total' => $items->sum('qty'),
                    'revenue_total' => (float) $items->sum('line_total'),
                ];
            })
            ->sortByDesc('revenue_total')
            ->values();
    }

    private function buildSalesExportRows(array $filters, Carbon $dateFrom, Carbon $dateTo): array
    {
        $rows = $this->buildSalesQuery($filters, $dateFrom, $dateTo)
            ->with(['soldBy:id,name'])
            ->withCount('items')
            ->latest('sold_at')
            ->get()
            ->map(fn (Sale $sale) => [
                $sale->sale_no,
                $sale->sold_at?->format('Y-m-d H:i') ?? '-',
                $sale->customer_name ?? '-',
                $sale->customer_phone ?? '-',
                $sale->items_count,
                (float) $sale->subtotal,
                (float) $sale->discount_amount,
                (float) $sale->total_amount,
                $sale->payment_method_name_snapshot ?? '-',
                $sale->soldBy?->name ?? '-',
            ])
            ->all();

        return [[
            'No Penjualan',
            'Waktu Jual',
            'Customer',
            'No. HP',
            'Jumlah Item',
            'Subtotal',
            'Diskon',
            'Total',
            'Metode Pembayaran',
            'Kasir',
        ], $rows, 'laporan-penjualan'];
    }

    private function buildTopProductExportRows(array $filters, Carbon $dateFrom, Carbon $dateTo): array
    {
        $rows = $this->buildTopProducts($filters, $dateFrom, $dateTo)
            ->map(fn (array $item) => [
                $item['product_name'],
                $item['sku'],
                $item['transactions_count'],
                $item['qty_total'],
                $item['revenue_total'],
            ])
            ->all();

        return [[
            'Produk',
            'SKU',
            'Total Transaksi',
            'Qty Terjual',
            'Omzet',
        ], $rows, 'laporan-produk-jual-paling-laku'];
    }

    private function buildLowStockExportRows(array $filters): array
    {
        $rows = SaleProduct::query()
            ->where('active', true)
            ->whereColumn('stock_qty', '<=', 'min_stock_qty')
            ->orderBy('stock_qty')
            ->orderBy('name')
            ->get()
            ->map(fn (SaleProduct $saleProduct) => [
                $saleProduct->sku,
                $saleProduct->name,
                $saleProduct->category ?? '-',
                $saleProduct->stock_qty,
                $saleProduct->min_stock_qty,
                (float) $saleProduct->selling_price,
            ])
            ->all();

        return [[
            'SKU',
            'Produk',
            'Kategori',
            'Stok Saat Ini',
            'Minimum Stok',
            'Harga Jual',
        ], $rows, 'laporan-stok-menipis'];
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
}
