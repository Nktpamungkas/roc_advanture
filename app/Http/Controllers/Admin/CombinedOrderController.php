<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCombinedOrderRequest;
use App\Models\CombinedOrder;
use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\PaymentMethodConfig;
use App\Models\Rental;
use App\Models\SaleProduct;
use App\Models\SeasonRule;
use App\Services\AdminAccessService;
use App\Services\CombinedOrderCreationService;
use App\Services\CustomerRatingService;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentMethods;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CombinedOrderController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly CustomerRatingService $customerRatingService,
        private readonly CombinedOrderCreationService $combinedOrderCreationService,
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

        $availableUnits = InventoryUnit::query()
            ->with('product:id,name,daily_rate,active')
            ->whereIn('status', [
                InventoryUnitStatuses::READY_CLEAN,
                InventoryUnitStatuses::READY_UNCLEAN,
            ])
            ->whereHas('product', fn ($query) => $query->where('active', true))
            ->orderBy('unit_code')
            ->get()
            ->map(fn (InventoryUnit $inventoryUnit) => [
                'id' => $inventoryUnit->id,
                'product_id' => $inventoryUnit->product_id,
                'product_name' => $inventoryUnit->product?->name,
                'unit_code' => $inventoryUnit->unit_code,
                'status' => $inventoryUnit->status,
                'status_label' => InventoryUnitStatuses::label($inventoryUnit->status),
                'daily_rate' => (string) ($inventoryUnit->product?->daily_rate ?? 0),
                'notes' => $inventoryUnit->notes,
            ])
            ->values();

        $saleProducts = SaleProduct::query()
            ->where('active', true)
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
                'is_out_of_stock' => $saleProduct->stock_qty <= 0,
                'notes' => $saleProduct->notes,
            ])
            ->values();

        $customersCollection = Customer::query()
            ->orderBy('name')
            ->get()
            ->values();

        $customerRatings = $this->customerRatingService->summarizeMany($customersCollection);

        $customers = $customersCollection
            ->map(fn (Customer $customer) => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone_whatsapp' => $customer->phone_whatsapp,
                'address' => $customer->address,
                'rating' => $customerRatings[$customer->id] ?? null,
            ])
            ->values();

        $seasonRules = SeasonRule::query()
            ->where('active', true)
            ->orderBy('start_date')
            ->get()
            ->map(fn (SeasonRule $seasonRule) => [
                'id' => $seasonRule->id,
                'name' => $seasonRule->name,
                'start_date' => $seasonRule->start_date?->toDateString(),
                'end_date' => $seasonRule->end_date?->toDateString(),
                'dp_required' => (bool) $seasonRule->dp_required,
                'dp_type' => $seasonRule->dp_type,
                'dp_value' => $seasonRule->dp_value !== null ? (string) $seasonRule->dp_value : null,
            ])
            ->values();

        $recentCombinedOrdersQuery = CombinedOrder::query()
            ->with(['creator:id,name', 'rentals.items', 'sales.items'])
            ->when($filters['recent_search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('combined_no', 'like', '%'.$filters['recent_search'].'%')
                        ->orWhere('customer_name', 'like', '%'.$filters['recent_search'].'%')
                        ->orWhere('customer_phone', 'like', '%'.$filters['recent_search'].'%')
                        ->orWhereHas('rentals', function ($rentalQuery) use ($filters): void {
                            $rentalQuery
                                ->where('rental_no', 'like', '%'.$filters['recent_search'].'%')
                                ->orWhereHas('items', function ($itemQuery) use ($filters): void {
                                    $itemQuery->where('product_name_snapshot', 'like', '%'.$filters['recent_search'].'%');
                                });
                        })
                        ->orWhereHas('sales', function ($saleQuery) use ($filters): void {
                            $saleQuery
                                ->where('sale_no', 'like', '%'.$filters['recent_search'].'%')
                                ->orWhereHas('items', function ($itemQuery) use ($filters): void {
                                    $itemQuery
                                        ->where('product_name_snapshot', 'like', '%'.$filters['recent_search'].'%')
                                        ->orWhere('sku_snapshot', 'like', '%'.$filters['recent_search'].'%');
                                });
                        });
                });
            });

        $paginatedRecentCombinedOrders = $recentCombinedOrdersQuery
            ->latest('ordered_at')
            ->paginate($filters['recent_per_page'])
            ->withQueryString();

        $recentCombinedOrders = $paginatedRecentCombinedOrders->getCollection()
            ->map(fn (CombinedOrder $combinedOrder) => [
                'id' => $combinedOrder->id,
                'combined_no' => $combinedOrder->combined_no,
                'ordered_at' => $combinedOrder->ordered_at?->toIso8601String(),
                'customer_name' => $combinedOrder->customer_name,
                'customer_phone' => $combinedOrder->customer_phone,
                'rental_items_count' => $combinedOrder->rentals->sum(fn ($rental) => $rental->items->count()),
                'sale_items_count' => $combinedOrder->sales->sum(fn ($sale) => $sale->items->count()),
                'rental_total' => (string) $combinedOrder->rental_total,
                'sale_total' => (string) $combinedOrder->sale_total,
                'paid_amount' => (string) $combinedOrder->paid_amount,
                'remaining_amount' => (string) $combinedOrder->remaining_amount,
                'payment_status_label' => $this->combinedPaymentStatusLabel($combinedOrder->payment_status),
            ])
            ->values();

        return Inertia::render('admin/combined-orders/index', [
            'customers' => $customers,
            'availableUnits' => $availableUnits,
            'saleProducts' => $saleProducts,
            'seasonRules' => $seasonRules,
            'paymentMethodOptions' => $this->activePaymentMethodOptions(),
            'recentCombinedOrders' => $recentCombinedOrders,
            'combinedFilters' => $filters,
            'combinedPagination' => [
                'current_page' => $paginatedRecentCombinedOrders->currentPage(),
                'last_page' => $paginatedRecentCombinedOrders->lastPage(),
                'per_page' => $paginatedRecentCombinedOrders->perPage(),
                'total' => $paginatedRecentCombinedOrders->total(),
                'from' => $paginatedRecentCombinedOrders->firstItem(),
                'to' => $paginatedRecentCombinedOrders->lastItem(),
            ],
            'combinedSummary' => [
                'available_rental_units' => $availableUnits->count(),
                'available_sale_products' => $saleProducts->count(),
                'combined_today' => CombinedOrder::query()->whereDate('ordered_at', now()->toDateString())->count(),
                'active_rentals' => Rental::query()->whereIn('rental_status', [
                    RentalStatuses::BOOKED,
                    RentalStatuses::PICKED_UP,
                    RentalStatuses::LATE,
                ])->count(),
            ],
        ]);
    }

    public function store(StoreCombinedOrderRequest $request): RedirectResponse
    {
        $actor = $request->user();

        abort_unless($actor !== null, 403);

        $combinedOrder = $this->combinedOrderCreationService->create($actor, $request->validated());

        return to_route('admin.combined-orders.show', $combinedOrder)->with('success', 'Transaksi gabungan berhasil dibuat.');
    }

    public function show(CombinedOrder $combinedOrder): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $combinedOrder->load([
            'creator',
            'rentals.customer',
            'rentals.items.inventoryUnit.product',
            'rentals.payments.receiver',
            'sales.soldBy',
            'sales.items.saleProduct',
        ]);

        $rental = $combinedOrder->rentals->first();
        $sale = $combinedOrder->sales->first();

        return Inertia::render('admin/combined-orders/show', [
            'combinedOrder' => [
                'id' => $combinedOrder->id,
                'combined_no' => $combinedOrder->combined_no,
                'ordered_at' => $combinedOrder->ordered_at?->toIso8601String(),
                'customer_name' => $combinedOrder->customer_name,
                'customer_phone' => $combinedOrder->customer_phone,
                'subtotal' => (string) $combinedOrder->subtotal,
                'discount_amount' => (string) $combinedOrder->discount_amount,
                'rental_total' => (string) $combinedOrder->rental_total,
                'sale_total' => (string) $combinedOrder->sale_total,
                'paid_amount' => (string) $combinedOrder->paid_amount,
                'remaining_amount' => (string) $combinedOrder->remaining_amount,
                'payment_status_label' => $this->combinedPaymentStatusLabel($combinedOrder->payment_status),
                'notes' => $combinedOrder->notes,
                'payment_method' => [
                    'name' => $combinedOrder->payment_method_name_snapshot,
                    'type' => $combinedOrder->payment_method_type_snapshot,
                    'type_label' => PaymentMethods::label($combinedOrder->payment_method_type_snapshot),
                    'qr_image_path' => $combinedOrder->payment_qr_image_path_snapshot,
                    'bank_name' => $combinedOrder->payment_transfer_bank_snapshot,
                    'account_number' => $combinedOrder->payment_transfer_account_number_snapshot,
                    'account_name' => $combinedOrder->payment_transfer_account_name_snapshot,
                    'instructions' => $combinedOrder->payment_instruction_snapshot,
                ],
                'creator' => [
                    'name' => $combinedOrder->creator?->name,
                ],
                'rental' => $rental ? [
                    'rental_no' => $rental->rental_no,
                    'starts_at' => $rental->starts_at?->toIso8601String(),
                    'due_at' => $rental->due_at?->toIso8601String(),
                    'total_days' => $rental->total_days,
                    'guarantee_note' => $rental->guarantee_note,
                    'customer_address' => $rental->customer?->address,
                    'paid_amount' => (string) $rental->paid_amount,
                    'remaining_amount' => (string) $rental->remaining_amount,
                    'payment_status_label' => RentalPaymentStatuses::label($rental->payment_status),
                    'items' => $rental->items
                        ->map(fn ($item) => [
                            'id' => $item->id,
                            'product_name_snapshot' => $item->product_name_snapshot,
                            'inventory_unit_code' => $item->inventoryUnit?->unit_code,
                            'daily_rate_snapshot' => (string) $item->daily_rate_snapshot,
                            'days' => $item->days,
                            'line_total' => (string) $item->line_total,
                            'status_at_checkout_label' => InventoryUnitStatuses::label($item->status_at_checkout),
                        ])
                        ->values(),
                    'payments' => $rental->payments
                        ->map(fn ($payment) => [
                            'id' => $payment->id,
                            'amount' => (string) $payment->amount,
                            'paid_at' => $payment->paid_at?->toIso8601String(),
                            'method_label' => $payment->method_label_snapshot ?: PaymentMethods::label($payment->method),
                            'receiver_name' => $payment->receiver?->name,
                            'notes' => $payment->notes,
                        ])
                        ->values(),
                ] : null,
                'sale' => $sale ? [
                    'sale_no' => $sale->sale_no,
                    'sold_at' => $sale->sold_at?->toIso8601String(),
                    'total_amount' => (string) $sale->total_amount,
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
                ] : null,
            ],
        ]);
    }

    /**
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    private function activePaymentMethodOptions()
    {
        return PaymentMethodConfig::query()
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
    }

    private function combinedPaymentStatusLabel(?string $status): string
    {
        return match ($status) {
            'paid' => 'Lunas',
            'partial', 'dp_paid' => 'Dibayar Sebagian',
            'unpaid', null, '' => 'Belum Dibayar',
            default => (string) $status,
        };
    }
}
