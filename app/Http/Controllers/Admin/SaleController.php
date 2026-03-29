<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreSaleRequest;
use App\Models\PaymentMethodConfig;
use App\Models\Sale;
use App\Models\SaleProduct;
use App\Services\AdminAccessService;
use App\Services\SaleCreationService;
use App\Support\Rental\PaymentMethods;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SaleController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly SaleCreationService $saleCreationService,
    ) {
    }

    public function index(Request $request): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $filters = [
            'recent_search' => trim((string) $request->input('recent_search', '')),
            'recent_per_page' => in_array($request->integer('recent_per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('recent_per_page', 10)
                : 10,
        ];

        $availableProducts = SaleProduct::query()
            ->where('active', true)
            ->where('stock_qty', '>', 0)
            ->orderBy('name')
            ->get()
            ->map(fn (SaleProduct $saleProduct) => [
                'id' => $saleProduct->id,
                'sku' => $saleProduct->sku,
                'name' => $saleProduct->name,
                'category' => $saleProduct->category,
                'selling_price' => (string) $saleProduct->selling_price,
                'stock_qty' => $saleProduct->stock_qty,
                'min_stock_qty' => $saleProduct->min_stock_qty,
                'is_low_stock' => $saleProduct->stock_qty <= $saleProduct->min_stock_qty,
                'notes' => $saleProduct->notes,
            ])
            ->values();

        $paymentMethodOptions = PaymentMethodConfig::query()
            ->where('active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (PaymentMethodConfig $paymentMethodConfig) => [
                'value' => (string) $paymentMethodConfig->id,
                'label' => $paymentMethodConfig->name,
                'type' => $paymentMethodConfig->type,
                'type_label' => PaymentMethods::label($paymentMethodConfig->type),
                'instructions' => $paymentMethodConfig->instructions,
                'bank_name' => $paymentMethodConfig->bank_name,
                'account_number' => $paymentMethodConfig->account_number,
                'account_name' => $paymentMethodConfig->account_name,
                'qr_image_path' => $paymentMethodConfig->qr_image_path,
            ])
            ->values();

        $recentSalesQuery = Sale::query()
            ->with(['soldBy:id,name'])
            ->withCount('items')
            ->when($filters['recent_search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('sale_no', 'like', '%'.$filters['recent_search'].'%')
                        ->orWhere('customer_name', 'like', '%'.$filters['recent_search'].'%')
                        ->orWhere('customer_phone', 'like', '%'.$filters['recent_search'].'%')
                        ->orWhereHas('items', function ($itemQuery) use ($filters): void {
                            $itemQuery
                                ->where('product_name_snapshot', 'like', '%'.$filters['recent_search'].'%')
                                ->orWhere('sku_snapshot', 'like', '%'.$filters['recent_search'].'%');
                        });
                });
            });

        $paginatedRecentSales = $recentSalesQuery
            ->latest('sold_at')
            ->paginate($filters['recent_per_page'])
            ->withQueryString();

        return Inertia::render('admin/sales/index', [
            'saleProducts' => $availableProducts,
            'paymentMethodOptions' => $paymentMethodOptions,
            'recentSales' => $paginatedRecentSales->getCollection()
                ->map(fn (Sale $sale) => [
                    'id' => $sale->id,
                    'sale_no' => $sale->sale_no,
                    'sold_at' => $sale->sold_at?->toIso8601String(),
                    'customer_name' => $sale->customer_name,
                    'customer_phone' => $sale->customer_phone,
                    'items_count' => $sale->items_count,
                    'total_amount' => (string) $sale->total_amount,
                    'payment_method_name' => $sale->payment_method_name_snapshot,
                    'sold_by_name' => $sale->soldBy?->name,
                ])
                ->values(),
            'saleFilters' => $filters,
            'salePagination' => [
                'current_page' => $paginatedRecentSales->currentPage(),
                'last_page' => $paginatedRecentSales->lastPage(),
                'per_page' => $paginatedRecentSales->perPage(),
                'total' => $paginatedRecentSales->total(),
                'from' => $paginatedRecentSales->firstItem(),
                'to' => $paginatedRecentSales->lastItem(),
            ],
            'saleSummary' => [
                'available_products' => $availableProducts->count(),
                'low_stock_products' => $availableProducts->where('is_low_stock', true)->count(),
                'total_stock_qty' => SaleProduct::query()->sum('stock_qty'),
                'sales_today' => Sale::query()->whereDate('sold_at', now()->toDateString())->count(),
            ],
        ]);
    }

    public function store(StoreSaleRequest $request): RedirectResponse
    {
        $actor = $request->user();
        abort_unless($actor !== null, 403);

        $sale = $this->saleCreationService->create($actor, $request->validated());

        return to_route('admin.sales.show', $sale)->with('success', 'Transaksi penjualan berhasil dibuat.');
    }

    public function show(Sale $sale): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $sale->load(['soldBy', 'items.saleProduct', 'paymentMethodConfig']);

        return Inertia::render('admin/sales/show', [
            'sale' => [
                'id' => $sale->id,
                'sale_no' => $sale->sale_no,
                'sold_at' => $sale->sold_at?->toIso8601String(),
                'customer_name' => $sale->customer_name,
                'customer_phone' => $sale->customer_phone,
                'subtotal' => (string) $sale->subtotal,
                'discount_amount' => (string) $sale->discount_amount,
                'total_amount' => (string) $sale->total_amount,
                'notes' => $sale->notes,
                'payment_method' => [
                    'name' => $sale->payment_method_name_snapshot,
                    'type' => $sale->payment_method_type_snapshot,
                    'type_label' => PaymentMethods::label($sale->payment_method_type_snapshot),
                    'qr_image_path' => $sale->payment_qr_image_path_snapshot,
                    'bank_name' => $sale->payment_transfer_bank_snapshot,
                    'account_number' => $sale->payment_transfer_account_number_snapshot,
                    'account_name' => $sale->payment_transfer_account_name_snapshot,
                    'instructions' => $sale->payment_instruction_snapshot,
                ],
                'sold_by' => [
                    'name' => $sale->soldBy?->name,
                ],
                'items' => $sale->items
                    ->map(fn ($item) => [
                        'id' => $item->id,
                        'product_name_snapshot' => $item->product_name_snapshot,
                        'sku_snapshot' => $item->sku_snapshot,
                        'selling_price_snapshot' => (string) $item->selling_price_snapshot,
                        'qty' => $item->qty,
                        'line_total' => (string) $item->line_total,
                    ])
                    ->values(),
            ],
        ]);
    }
}
