<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpsertSaleProductRequest;
use App\Models\SaleProduct;
use App\Services\AdminAccessService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SaleProductController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
    ) {
    }

    public function index(Request $request): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'status' => (string) $request->input('status', ''),
            'stock_state' => (string) $request->input('stock_state', ''),
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];

        $query = SaleProduct::query()
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('name', 'like', '%'.$filters['search'].'%')
                        ->orWhere('sku', 'like', '%'.$filters['search'].'%')
                        ->orWhere('category', 'like', '%'.$filters['search'].'%');
                });
            })
            ->when($filters['status'] !== '', fn ($query) => $query->where('active', $filters['status'] === 'active'))
            ->when($filters['stock_state'] === 'low', fn ($query) => $query->whereColumn('stock_qty', '<=', 'min_stock_qty'))
            ->when($filters['stock_state'] === 'out', fn ($query) => $query->where('stock_qty', 0));

        $paginatedProducts = $query
            ->orderBy('name')
            ->paginate($filters['per_page'])
            ->withQueryString();

        return Inertia::render('admin/sale-products/index', [
            'saleProducts' => $paginatedProducts->getCollection()
                ->map(fn (SaleProduct $saleProduct) => [
                    'id' => $saleProduct->id,
                    'sku' => $saleProduct->sku,
                    'name' => $saleProduct->name,
                    'category' => $saleProduct->category,
                    'purchase_price' => (string) $saleProduct->purchase_price,
                    'selling_price' => (string) $saleProduct->selling_price,
                    'stock_qty' => $saleProduct->stock_qty,
                    'min_stock_qty' => $saleProduct->min_stock_qty,
                    'active' => (bool) $saleProduct->active,
                    'is_low_stock' => $saleProduct->stock_qty <= $saleProduct->min_stock_qty,
                    'notes' => $saleProduct->notes,
                ])
                ->values(),
            'saleProductFilters' => $filters,
            'saleProductPagination' => [
                'current_page' => $paginatedProducts->currentPage(),
                'last_page' => $paginatedProducts->lastPage(),
                'per_page' => $paginatedProducts->perPage(),
                'total' => $paginatedProducts->total(),
                'from' => $paginatedProducts->firstItem(),
                'to' => $paginatedProducts->lastItem(),
            ],
            'saleProductSummary' => [
                'total_products' => SaleProduct::query()->count(),
                'active_products' => SaleProduct::query()->where('active', true)->count(),
                'low_stock_products' => SaleProduct::query()->whereColumn('stock_qty', '<=', 'min_stock_qty')->count(),
                'total_stock_qty' => SaleProduct::query()->sum('stock_qty'),
                'filtered_products' => $paginatedProducts->total(),
            ],
        ]);
    }

    public function store(UpsertSaleProductRequest $request): RedirectResponse
    {
        SaleProduct::query()->create([
            ...$request->validated(),
            'stock_qty' => 0,
        ]);

        return to_route('admin.sale-products.index')->with('success', 'Produk jual berhasil dibuat.');
    }

    public function update(UpsertSaleProductRequest $request, SaleProduct $saleProduct): RedirectResponse
    {
        $saleProduct->update($request->validated());

        return to_route('admin.sale-products.index')->with('success', 'Produk jual berhasil diperbarui.');
    }
}
