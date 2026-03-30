<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\WaLog;
use App\Services\AdminAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WhatsappHistoryController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
    ) {
    }

    public function index(Request $request): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $activeTab = in_array((string) $request->input('tab', 'reminders'), ['reminders', 'invoices'], true)
            ? (string) $request->input('tab', 'reminders')
            : 'reminders';

        $reminderFilters = $this->resolveFilters($request, 'reminder_');
        $invoiceFilters = $this->resolveFilters($request, 'invoice_');

        $reminderQuery = $this->buildReminderQuery($reminderFilters)->with(['rental.customer']);
        $invoiceQuery = $this->buildInvoiceQuery($invoiceFilters)->with(['rental.customer']);

        $paginatedReminders = (clone $reminderQuery)
            ->latest('scheduled_at')
            ->paginate($reminderFilters['per_page'], ['*'], 'reminder_page')
            ->withQueryString();

        $paginatedInvoices = (clone $invoiceQuery)
            ->latest('scheduled_at')
            ->paginate($invoiceFilters['per_page'], ['*'], 'invoice_page')
            ->withQueryString();

        $reminderSummary = $this->buildSummary((clone $reminderQuery)->get(['id', 'status']));
        $invoiceSummary = $this->buildSummary((clone $invoiceQuery)->get(['id', 'status']));

        return Inertia::render('admin/whatsapp-history/index', [
            'activeTab' => $activeTab,
            'statusOptions' => [
                ['value' => 'all', 'label' => 'Semua status'],
                ['value' => 'sent', 'label' => 'Terkirim'],
                ['value' => 'pending', 'label' => 'Pending'],
                ['value' => 'failed', 'label' => 'Gagal'],
            ],
            'reminderFilters' => $reminderFilters,
            'invoiceFilters' => $invoiceFilters,
            'reminderSummary' => $reminderSummary,
            'invoiceSummary' => $invoiceSummary,
            'reminders' => $paginatedReminders->getCollection()
                ->map(fn (WaLog $log) => $this->transformLog($log))
                ->values(),
            'invoices' => $paginatedInvoices->getCollection()
                ->map(fn (WaLog $log) => $this->transformLog($log))
                ->values(),
            'reminderPagination' => $this->transformPagination($paginatedReminders),
            'invoicePagination' => $this->transformPagination($paginatedInvoices),
        ]);
    }

    public function destroy(WaLog $waLog): RedirectResponse
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $waLog->delete();

        return back()->with('success', 'History WhatsApp berhasil dihapus.');
    }

    public function destroySelected(Request $request): RedirectResponse
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $validated = $request->validate([
            'tab' => ['required', 'in:reminders,invoices'],
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
        ]);

        $deletedCount = $this->queryForTab($validated['tab'])
            ->whereKey($validated['ids'])
            ->delete();

        return back()->with('success', sprintf('%d history WhatsApp berhasil dihapus.', $deletedCount));
    }

    public function destroyAll(Request $request): RedirectResponse
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $validated = $request->validate([
            'tab' => ['required', 'in:reminders,invoices'],
        ]);

        $deletedCount = $this->queryForTab($validated['tab'])->delete();
        $label = $validated['tab'] === 'reminders' ? 'reminder jatuh tempo' : 'invoice WhatsApp';

        return back()->with('success', sprintf('%d data %s berhasil dihapus.', $deletedCount, $label));
    }

    private function resolveFilters(Request $request, string $prefix): array
    {
        $status = (string) $request->input($prefix.'status', 'all');
        $perPage = $request->integer($prefix.'per_page', 10);

        return [
            'search' => trim((string) $request->input($prefix.'search', '')),
            'status' => in_array($status, ['all', 'sent', 'pending', 'failed'], true) ? $status : 'all',
            'per_page' => in_array($perPage, [10, 15, 25, 50], true) ? $perPage : 10,
        ];
    }

    private function buildReminderQuery(array $filters): Builder
    {
        return $this->applyCommonFilters(
            $this->queryForTab('reminders'),
            $filters,
        );
    }

    private function buildInvoiceQuery(array $filters): Builder
    {
        return $this->applyCommonFilters(
            $this->queryForTab('invoices'),
            $filters,
        );
    }

    private function queryForTab(string $tab): Builder
    {
        return match ($tab) {
            'reminders' => WaLog::query()->where('message_type', 'rental_due_reminder'),
            'invoices' => WaLog::query()->where('message_type', 'like', 'rental_invoice%'),
            default => WaLog::query()->whereRaw('1 = 0'),
        };
    }

    private function applyCommonFilters(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['search'] !== '', function (Builder $builder) use ($filters): void {
                $search = $filters['search'];

                $builder->where(function (Builder $nestedQuery) use ($search): void {
                    $nestedQuery
                        ->where('phone', 'like', '%'.$search.'%')
                        ->orWhere('provider_message_id', 'like', '%'.$search.'%')
                        ->orWhereHas('rental', function (Builder $rentalQuery) use ($search): void {
                            $rentalQuery
                                ->where('rental_no', 'like', '%'.$search.'%')
                                ->orWhereHas('customer', function (Builder $customerQuery) use ($search): void {
                                    $customerQuery
                                        ->where('name', 'like', '%'.$search.'%')
                                        ->orWhere('phone_whatsapp', 'like', '%'.$search.'%');
                                });
                        });
                });
            })
            ->when($filters['status'] !== 'all', fn (Builder $builder) => $builder->where('status', $filters['status']));
    }

    private function buildSummary($logs): array
    {
        return [
            'total' => $logs->count(),
            'sent' => $logs->where('status', 'sent')->count(),
            'pending' => $logs->where('status', 'pending')->count(),
            'failed' => $logs->where('status', 'failed')->count(),
        ];
    }

    private function transformLog(WaLog $log): array
    {
        return [
            'id' => $log->id,
            'rental_id' => $log->rental_id,
            'rental_no' => $log->rental?->rental_no,
            'customer_name' => $log->rental?->customer?->name,
            'customer_phone' => $log->rental?->customer?->phone_whatsapp,
            'phone' => $log->phone,
            'message_type' => $log->message_type,
            'message_type_label' => $this->messageTypeLabel($log->message_type),
            'scheduled_at' => $log->scheduled_at?->toIso8601String(),
            'sent_at' => $log->sent_at?->toIso8601String(),
            'created_at' => $log->created_at?->toIso8601String(),
            'due_at' => $log->rental?->due_at?->toIso8601String(),
            'status' => $log->status,
            'status_label' => $this->statusLabel($log->status),
            'provider_message_id' => $log->provider_message_id,
        ];
    }

    private function transformPagination($paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'sent' => 'Terkirim',
            'pending' => 'Pending',
            'failed' => 'Gagal',
            default => ucfirst($status),
        };
    }

    private function messageTypeLabel(string $messageType): string
    {
        if ($messageType === 'rental_due_reminder') {
            return 'Reminder Jatuh Tempo';
        }

        if (str_starts_with($messageType, 'rental_invoice')) {
            return 'Invoice via WhatsApp';
        }

        return ucfirst(str_replace('_', ' ', $messageType));
    }
}
