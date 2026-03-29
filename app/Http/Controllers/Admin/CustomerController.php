<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpsertCustomerRequest;
use App\Models\Customer;
use App\Services\AdminAccessService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
    ) {
    }

    public function index(): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $customers = Customer::query()
            ->withCount('rentals')
            ->orderBy('name')
            ->get()
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
