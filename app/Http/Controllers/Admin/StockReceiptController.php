<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreStockReceiptRequest;
use App\Models\SaleProduct;
use App\Models\StockReceipt;
use App\Models\StockReceiptItem;
use App\Services\AdminAccessService;
use App\Services\StockReceiptService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StockReceiptController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly StockReceiptService $stockReceiptService,
    ) {
    }

    public function index(Request $request): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];

        $query = StockReceipt::query()
            ->with('receiver:id,name')
            ->withCount('items')
            ->withSum('items as total_qty', 'qty')
            ->withSum('items as total_amount', 'line_total')
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('receipt_no', 'like', '%'.$filters['search'].'%')
                        ->orWhere('supplier_name', 'like', '%'.$filters['search'].'%')
                        ->orWhereHas('items', function ($itemQuery) use ($filters): void {
                            $itemQuery
                                ->where('product_name_snapshot', 'like', '%'.$filters['search'].'%')
                                ->orWhere('sku_snapshot', 'like', '%'.$filters['search'].'%');
                        });
                });
            });

        $paginatedReceipts = $query
            ->latest('received_at')
            ->paginate($filters['per_page'])
            ->withQueryString();

        return Inertia::render('admin/stock-receipts/index', [
            'stockReceipts' => $paginatedReceipts->getCollection()
                ->map(fn (StockReceipt $stockReceipt) => [
                    'id' => $stockReceipt->id,
                    'receipt_no' => $stockReceipt->receipt_no,
                    'supplier_name' => $stockReceipt->supplier_name,
                    'received_at' => $stockReceipt->received_at?->toIso8601String(),
                    'items_count' => $stockReceipt->items_count,
                    'total_qty' => (int) ($stockReceipt->total_qty ?? 0),
                    'total_amount' => (string) ($stockReceipt->total_amount ?? 0),
                    'receiver_name' => $stockReceipt->receiver?->name,
                    'notes' => $stockReceipt->notes,
                ])
                ->values(),
            'stockReceiptFilters' => $filters,
            'stockReceiptPagination' => [
                'current_page' => $paginatedReceipts->currentPage(),
                'last_page' => $paginatedReceipts->lastPage(),
                'per_page' => $paginatedReceipts->perPage(),
                'total' => $paginatedReceipts->total(),
                'from' => $paginatedReceipts->firstItem(),
                'to' => $paginatedReceipts->lastItem(),
            ],
            'stockReceiptSummary' => [
                'total_receipts' => StockReceipt::query()->count(),
                'total_received_qty' => (int) StockReceiptItem::query()->sum('qty'),
                'total_inventory_value' => (string) StockReceiptItem::query()->sum('line_total'),
                'filtered_receipts' => $paginatedReceipts->total(),
            ],
            'saleProductOptions' => SaleProduct::query()
                ->orderBy('name')
                ->get()
                ->map(fn (SaleProduct $saleProduct) => [
                    'value' => (string) $saleProduct->id,
                    'label' => $saleProduct->active ? $saleProduct->name : $saleProduct->name.' (Nonaktif)',
                    'sku' => $saleProduct->sku,
                    'purchase_price' => (string) $saleProduct->purchase_price,
                    'selling_price' => (string) $saleProduct->selling_price,
                    'stock_qty' => $saleProduct->stock_qty,
                    'active' => (bool) $saleProduct->active,
                ])
                ->values(),
        ]);
    }

    public function store(StoreStockReceiptRequest $request): RedirectResponse
    {
        $actor = $request->user();
        abort_unless($actor !== null, 403);

        $this->stockReceiptService->create($actor, $request->validated());

        return to_route('admin.stock-receipts.index')->with('success', 'Stok masuk berhasil disimpan.');
    }
}
