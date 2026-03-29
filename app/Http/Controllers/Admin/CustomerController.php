<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpsertCustomerRequest;
use App\Models\Customer;
use App\Models\Rental;
use App\Services\AdminAccessService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
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
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];

        $customerQuery = Customer::query()
            ->withCount('rentals')
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('name', 'like', '%'.$filters['search'].'%')
                        ->orWhere('phone_whatsapp', 'like', '%'.$filters['search'].'%')
                        ->orWhere('address', 'like', '%'.$filters['search'].'%');
                });
            });

        $paginatedCustomers = $customerQuery
            ->orderBy('name')
            ->paginate($filters['per_page'])
            ->withQueryString();

        $customers = $paginatedCustomers->getCollection()
            ->map(fn (Customer $customer) => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone_whatsapp' => $customer->phone_whatsapp,
                'address' => $customer->address,
                'notes' => $customer->notes,
                'rentals_count' => $customer->rentals_count,
            ])
            ->values();

        return Inertia::render('admin/customers/index', [
            'customers' => $customers,
            'customerFilters' => $filters,
            'customerPagination' => [
                'current_page' => $paginatedCustomers->currentPage(),
                'last_page' => $paginatedCustomers->lastPage(),
                'per_page' => $paginatedCustomers->perPage(),
                'total' => $paginatedCustomers->total(),
                'from' => $paginatedCustomers->firstItem(),
                'to' => $paginatedCustomers->lastItem(),
            ],
            'customerSummary' => [
                'total_customers' => Customer::query()->count(),
                'filtered_customers' => $paginatedCustomers->total(),
                'total_rentals' => Rental::query()->count(),
            ],
        ]);
    }

    public function store(UpsertCustomerRequest $request): RedirectResponse
    {
        Customer::create($request->validated());

        return to_route('admin.customers.index')->with('success', 'Customer berhasil dibuat.');
    }

    public function update(UpsertCustomerRequest $request, Customer $customer): RedirectResponse
    {
        $customer->update($request->validated());

        return to_route('admin.customers.index')->with('success', 'Customer berhasil diperbarui.');
    }
}
