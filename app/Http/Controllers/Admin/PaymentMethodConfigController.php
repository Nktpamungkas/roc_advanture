<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpsertPaymentMethodConfigRequest;
use App\Models\PaymentMethodConfig;
use App\Services\AdminAccessService;
use App\Services\PaymentMethodAssetService;
use App\Support\Rental\PaymentMethods;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PaymentMethodConfigController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly PaymentMethodAssetService $paymentMethodAssetService,
    ) {}

    public function index(Request $request): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->isSuperAdmin($actor), 403);

        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'type' => (string) $request->input('type', ''),
            'status' => (string) $request->input('status', ''),
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];

        $query = PaymentMethodConfig::query()
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('name', 'like', '%'.$filters['search'].'%')
                        ->orWhere('bank_name', 'like', '%'.$filters['search'].'%')
                        ->orWhere('account_number', 'like', '%'.$filters['search'].'%');
                });
            })
            ->when($filters['type'] !== '', fn ($query) => $query->where('type', $filters['type']))
            ->when($filters['status'] !== '', fn ($query) => $query->where('active', $filters['status'] === 'active'));

        $paginatedMethods = $query
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate($filters['per_page'])
            ->withQueryString();

        return Inertia::render('admin/payment-methods/index', [
            'paymentMethods' => $paginatedMethods->getCollection()
                ->map(fn (PaymentMethodConfig $paymentMethodConfig) => [
                    'id' => $paymentMethodConfig->id,
                    'name' => $paymentMethodConfig->name,
                    'type' => $paymentMethodConfig->type,
                    'type_label' => PaymentMethods::label($paymentMethodConfig->type),
                    'code' => $paymentMethodConfig->code,
                    'bank_name' => $paymentMethodConfig->bank_name,
                    'account_number' => $paymentMethodConfig->account_number,
                    'account_name' => $paymentMethodConfig->account_name,
                    'qr_image_path' => $paymentMethodConfig->qr_image_path,
                    'instructions' => $paymentMethodConfig->instructions,
                    'active' => (bool) $paymentMethodConfig->active,
                    'sort_order' => $paymentMethodConfig->sort_order,
                ])
                ->values(),
            'paymentMethodFilters' => $filters,
            'paymentMethodPagination' => [
                'current_page' => $paginatedMethods->currentPage(),
                'last_page' => $paginatedMethods->lastPage(),
                'per_page' => $paginatedMethods->perPage(),
                'total' => $paginatedMethods->total(),
                'from' => $paginatedMethods->firstItem(),
                'to' => $paginatedMethods->lastItem(),
            ],
            'paymentMethodSummary' => [
                'total_methods' => PaymentMethodConfig::query()->count(),
                'active_methods' => PaymentMethodConfig::query()->where('active', true)->count(),
                'qris_methods' => PaymentMethodConfig::query()->where('type', PaymentMethods::QRIS)->count(),
            ],
            'paymentMethodTypeOptions' => PaymentMethods::options(),
        ]);
    }

    public function store(UpsertPaymentMethodConfigRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $validated['qr_image_path'] = $request->qrImage()
            ? $this->paymentMethodAssetService->storeQrImage($request->qrImage())
            : null;

        unset($validated['qr_image']);

        PaymentMethodConfig::query()->create($validated);

        return to_route('admin.payment-methods.index')->with('success', 'Metode pembayaran berhasil dibuat.');
    }

    public function update(UpsertPaymentMethodConfigRequest $request, PaymentMethodConfig $paymentMethodConfig): RedirectResponse
    {
        $validated = $request->validated();

        if ($request->qrImage()) {
            $this->paymentMethodAssetService->deleteIfExists($paymentMethodConfig->qr_image_path);
            $validated['qr_image_path'] = $this->paymentMethodAssetService->storeQrImage($request->qrImage());
        }

        unset($validated['qr_image']);

        $paymentMethodConfig->update($validated);

        return to_route('admin.payment-methods.index')->with('success', 'Metode pembayaran berhasil diperbarui.');
    }
}
