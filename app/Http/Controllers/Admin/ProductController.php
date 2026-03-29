<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpsertProductRequest;
use App\Models\Product;
use App\Services\AdminAccessService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
    ) {
    }

    public function index(): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $products = Product::query()
            ->withCount('inventoryUnits')
            ->orderBy('name')
            ->get()
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category,
                'daily_rate' => (string) $product->daily_rate,
                'active' => (bool) $product->active,
                'notes' => $product->notes,
                'inventory_units_count' => $product->inventory_units_count,
            ])
            ->values();

        return Inertia::render('admin/products/index', [
            'products' => $products,
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
