<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ExtendRentalRequest;
use App\Http\Requests\Admin\StoreRentalRequest;
use App\Models\Customer;
use App\Models\InventoryUnit;
use App\Models\PaymentMethodConfig;
use App\Models\Rental;
use App\Models\SeasonRule;
use App\Services\AdminAccessService;
use App\Services\CustomerRatingService;
use App\Services\RentalCreationService;
use App\Services\RentalExtensionService;
use App\Services\WhatsappService;
use App\Support\Rental\InventoryUnitStatuses;
use App\Support\Rental\PaymentMethods;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RentalController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly CustomerRatingService $customerRatingService,
        private readonly RentalCreationService $rentalCreationService,
        private readonly RentalExtensionService $rentalExtensionService,
        private readonly WhatsappService $whatsappService,
    ) {}

    public function index(Request $request): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $rentalFilters = [
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
                'notes' => $seasonRule->notes,
            ])
            ->values();

        $recentRentalsQuery = Rental::query()
            ->with('customer:id,name')
            ->withCount('items')
            ->when($rentalFilters['recent_search'] !== '', function ($query) use ($rentalFilters): void {
                $query->where(function ($nestedQuery) use ($rentalFilters): void {
                    $nestedQuery
                        ->where('rental_no', 'like', '%'.$rentalFilters['recent_search'].'%')
                        ->orWhereHas('customer', function ($customerQuery) use ($rentalFilters): void {
                            $customerQuery
                                ->where('name', 'like', '%'.$rentalFilters['recent_search'].'%')
                                ->orWhere('phone_whatsapp', 'like', '%'.$rentalFilters['recent_search'].'%');
                        });
                });
            });

        $paginatedRecentRentals = $recentRentalsQuery
            ->latest()
            ->paginate($rentalFilters['recent_per_page'])
            ->withQueryString();

        $recentRentals = $paginatedRecentRentals->getCollection()
            ->map(fn (Rental $rental) => [
                'id' => $rental->id,
                'rental_no' => $rental->rental_no,
                'customer_name' => $rental->customer?->name,
                'starts_at' => $rental->starts_at?->toIso8601String(),
                'due_at' => $rental->due_at?->toIso8601String(),
                'items_count' => $rental->items_count,
                'subtotal' => (string) $rental->subtotal,
                'paid_amount' => (string) $rental->paid_amount,
                'remaining_amount' => (string) $rental->remaining_amount,
                'payment_status' => $rental->payment_status,
                'payment_status_label' => RentalPaymentStatuses::label($rental->payment_status),
                'rental_status' => $rental->rental_status,
                'rental_status_label' => RentalStatuses::label($rental->rental_status),
            ])
            ->values();

        return Inertia::render('admin/rentals/index', [
            'customers' => $customers,
            'availableUnits' => $availableUnits,
            'seasonRules' => $seasonRules,
            'paymentMethodOptions' => $this->activePaymentMethodOptions(),
            'recentRentals' => $recentRentals,
            'rentalFilters' => $rentalFilters,
            'recentRentalPagination' => [
                'current_page' => $paginatedRecentRentals->currentPage(),
                'last_page' => $paginatedRecentRentals->lastPage(),
                'per_page' => $paginatedRecentRentals->perPage(),
                'total' => $paginatedRecentRentals->total(),
                'from' => $paginatedRecentRentals->firstItem(),
                'to' => $paginatedRecentRentals->lastItem(),
            ],
            'rentalSummary' => [
                'total_available_units' => $availableUnits->count(),
                'ready_clean_units' => $availableUnits->where('status', InventoryUnitStatuses::READY_CLEAN)->count(),
                'ready_unclean_units' => $availableUnits->where('status', InventoryUnitStatuses::READY_UNCLEAN)->count(),
                'active_rentals' => Rental::query()->whereIn('rental_status', [
                    RentalStatuses::BOOKED,
                    RentalStatuses::PICKED_UP,
                    RentalStatuses::LATE,
                ])->count(),
            ],
        ]);
    }

    public function store(StoreRentalRequest $request): RedirectResponse
    {
        $actor = $request->user();
        abort_unless($actor !== null, 403);

        $rental = $this->rentalCreationService->create($actor, $request->validated());

        return to_route('admin.rentals.show', $rental)->with('success', 'Transaksi penyewaan berhasil dibuat.');
    }

    public function extendForm(Rental $rental): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $rental->load([
            'customer',
            'creator',
            'items.inventoryUnit.product',
            'payments.receiver',
        ]);

        abort_unless(in_array($rental->rental_status, [RentalStatuses::PICKED_UP, RentalStatuses::LATE], true), 404);

        return Inertia::render('admin/rentals/extend', [
            'rental' => [
                'id' => $rental->id,
                'rental_no' => $rental->rental_no,
                'starts_at' => $rental->starts_at?->toIso8601String(),
                'due_at' => $rental->due_at?->toIso8601String(),
                'total_days' => $rental->total_days,
                'subtotal' => (string) $rental->subtotal,
                'paid_amount' => (string) $rental->paid_amount,
                'remaining_amount' => (string) $rental->remaining_amount,
                'rental_status' => $rental->rental_status,
                'rental_status_label' => RentalStatuses::label($rental->rental_status),
                'customer' => [
                    'name' => $rental->customer?->name,
                    'phone_whatsapp' => $rental->customer?->phone_whatsapp,
                    'address' => $rental->customer?->address,
                ],
                'creator' => [
                    'name' => $rental->creator?->name,
                ],
                'items' => $rental->items
                    ->map(fn ($item) => [
                        'id' => $item->id,
                        'product_name_snapshot' => $item->product_name_snapshot,
                        'inventory_unit_code' => $item->inventoryUnit?->unit_code,
                        'daily_rate_snapshot' => (string) $item->daily_rate_snapshot,
                    ])
                    ->values(),
            ],
            'paymentMethodOptions' => $this->activePaymentMethodOptions(),
        ]);
    }

    public function extend(ExtendRentalRequest $request, Rental $rental): RedirectResponse
    {
        $actor = $request->user();

        abort_unless($actor !== null, 403);

        $rental = $this->rentalExtensionService->extend($actor, $rental, $request->validated());

        return to_route('admin.rentals.show', $rental)->with('success', 'Perpanjangan sewa berhasil disimpan.');
    }

    public function show(Rental $rental): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $rental->load([
            'customer',
            'seasonRule',
            'creator',
            'items.inventoryUnit.product',
            'payments.receiver',
        ]);

        return Inertia::render('admin/rentals/show', [
            'rental' => [
                'id' => $rental->id,
                'rental_no' => $rental->rental_no,
                'starts_at' => $rental->starts_at?->toIso8601String(),
                'due_at' => $rental->due_at?->toIso8601String(),
                'total_days' => $rental->total_days,
                'final_total_days' => $rental->final_total_days,
                'dp_required' => (bool) $rental->dp_required,
                'subtotal' => (string) $rental->subtotal,
                'final_subtotal' => $rental->final_subtotal !== null ? (string) $rental->final_subtotal : null,
                'dp_amount' => (string) $rental->dp_amount,
                'dp_override_reason' => $rental->dp_override_reason,
                'paid_amount' => (string) $rental->paid_amount,
                'remaining_amount' => (string) $rental->remaining_amount,
                'payment_status' => $rental->payment_status,
                'payment_status_label' => RentalPaymentStatuses::label($rental->payment_status),
                'settlement_basis' => $rental->settlement_basis,
                'rental_status' => $rental->rental_status,
                'rental_status_label' => RentalStatuses::label($rental->rental_status),
                'guarantee_note' => $rental->guarantee_note,
                'notes' => $rental->notes,
                'can_extend' => in_array($rental->rental_status, [RentalStatuses::PICKED_UP, RentalStatuses::LATE], true),
                'payment_method' => [
                    'name' => $rental->payment_method_name_snapshot,
                    'type' => $rental->payment_method_type_snapshot,
                    'type_label' => PaymentMethods::label($rental->payment_method_type_snapshot),
                    'qr_image_path' => $rental->payment_qr_image_path_snapshot,
                    'bank_name' => $rental->payment_transfer_bank_snapshot,
                    'account_number' => $rental->payment_transfer_account_number_snapshot,
                    'account_name' => $rental->payment_transfer_account_name_snapshot,
                    'instructions' => $rental->payment_instruction_snapshot,
                ],
                'customer' => [
                    'name' => $rental->customer?->name,
                    'phone_whatsapp' => $rental->customer?->phone_whatsapp,
                    'address' => $rental->customer?->address,
                ],
                'season_rule' => $rental->seasonRule ? [
                    'name' => $rental->seasonRule->name,
                    'dp_required' => (bool) $rental->seasonRule->dp_required,
                ] : null,
                'creator' => [
                    'name' => $rental->creator?->name,
                ],
                'items' => $rental->items
                    ->map(fn ($item) => [
                        'id' => $item->id,
                        'product_name_snapshot' => $item->product_name_snapshot,
                        'inventory_unit_code' => $item->inventoryUnit?->unit_code,
                        'daily_rate_snapshot' => (string) $item->daily_rate_snapshot,
                        'days' => $item->days,
                        'line_total' => (string) $item->line_total,
                        'status_at_checkout' => $item->status_at_checkout,
                        'status_at_checkout_label' => InventoryUnitStatuses::label($item->status_at_checkout),
                    ])
                    ->values(),
                'payments' => $rental->payments
                    ->map(fn ($payment) => [
                        'id' => $payment->id,
                        'amount' => (string) $payment->amount,
                        'payment_kind' => $payment->payment_kind,
                        'paid_at' => $payment->paid_at?->toIso8601String(),
                        'method' => $payment->method,
                        'method_label' => $payment->method_label_snapshot ?: PaymentMethods::label($payment->method),
                        'receiver_name' => $payment->receiver?->name,
                        'instructions_snapshot' => $payment->instructions_snapshot,
                        'notes' => $payment->notes,
                    ])
                    ->values(),
            ],
        ]);
    }

    public function sendInvoiceWhatsapp(Rental $rental): RedirectResponse
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        try {
            $this->whatsappService->sendRentalInvoice($rental);

            return to_route('admin.rentals.show', $rental)->with('success', 'Invoice berhasil dikirim ke WhatsApp customer.');
        } catch (\Throwable $exception) {
            return to_route('admin.rentals.show', $rental)->with('error', $exception->getMessage());
        }
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
}
