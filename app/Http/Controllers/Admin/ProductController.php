<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpsertProductRequest;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Services\AdminAccessService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
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
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];

        $productQuery = Product::query()
            ->withCount('inventoryUnits')
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('name', 'like', '%'.$filters['search'].'%')
                        ->orWhere('category', 'like', '%'.$filters['search'].'%')
                        ->orWhere('prefix_code', 'like', '%'.$filters['search'].'%');
                });
            })
            ->when($filters['status'] !== '', fn ($query) => $query->where('active', $filters['status'] === 'active'));

        $paginatedProducts = $productQuery
            ->orderBy('name')
            ->paginate($filters['per_page'])
            ->withQueryString();

        $products = $paginatedProducts->getCollection()
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category,
                'prefix_code' => $product->prefix_code,
                'daily_rate' => (string) $product->daily_rate,
                'active' => (bool) $product->active,
                'notes' => $product->notes,
                'inventory_units_count' => $product->inventory_units_count,
            ])
            ->values();

        return Inertia::render('admin/products/index', [
            'products' => $products,
            'productFilters' => $filters,
            'productPagination' => [
                'current_page' => $paginatedProducts->currentPage(),
                'last_page' => $paginatedProducts->lastPage(),
                'per_page' => $paginatedProducts->perPage(),
                'total' => $paginatedProducts->total(),
                'from' => $paginatedProducts->firstItem(),
                'to' => $paginatedProducts->lastItem(),
            ],
            'productSummary' => [
                'total_products' => Product::query()->count(),
                'active_products' => Product::query()->where('active', true)->count(),
                'inactive_products' => Product::query()->where('active', false)->count(),
                'total_units' => InventoryUnit::query()->count(),
                'filtered_products' => $paginatedProducts->total(),
            ],
        ]);
    }

    public function store(UpsertProductRequest $request): RedirectResponse
    {
        Product::create($request->validated());

        return to_route('admin.products.index')->with('success', 'Produk berhasil dibuat.');
    }

    public function update(UpsertProductRequest $request, Product $product): RedirectResponse
    {
        $product->update($request->validated());

        return to_route('admin.products.index')->with('success', 'Produk berhasil diperbarui.');
    }
}
