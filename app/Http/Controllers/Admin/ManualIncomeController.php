<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreManualIncomeRequest;
use App\Models\ManualIncome;
use App\Services\AdminAccessService;
use App\Support\Finance\ManualIncomeCategories;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ManualIncomeController extends Controller
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
            'category' => (string) $request->input('category', ''),
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];

        $query = ManualIncome::query()
            ->with('recorder:id,name')
            ->when($filters['search'] !== '', function ($query) use ($filters): void {
                $query->where(function ($nestedQuery) use ($filters): void {
                    $nestedQuery
                        ->where('income_no', 'like', '%'.$filters['search'].'%')
                        ->orWhere('title', 'like', '%'.$filters['search'].'%')
                        ->orWhere('notes', 'like', '%'.$filters['search'].'%');
                });
            })
            ->when($filters['category'] !== '', fn ($query) => $query->where('category', $filters['category']));

        $paginatedIncomes = $query
            ->latest('recorded_at')
            ->paginate($filters['per_page'])
            ->withQueryString();

        return Inertia::render('admin/manual-incomes/index', [
            'manualIncomes' => $paginatedIncomes->getCollection()
                ->map(fn (ManualIncome $manualIncome) => [
                    'id' => $manualIncome->id,
                    'income_no' => $manualIncome->income_no,
                    'recorded_at' => $manualIncome->recorded_at?->toIso8601String(),
                    'category' => $manualIncome->category,
                    'category_label' => ManualIncomeCategories::label($manualIncome->category),
                    'title' => $manualIncome->title,
                    'amount' => (string) $manualIncome->amount,
                    'notes' => $manualIncome->notes,
                    'recorder_name' => $manualIncome->recorder?->name,
                ])
                ->values(),
            'manualIncomeFilters' => $filters,
            'manualIncomePagination' => [
                'current_page' => $paginatedIncomes->currentPage(),
                'last_page' => $paginatedIncomes->lastPage(),
                'per_page' => $paginatedIncomes->perPage(),
                'total' => $paginatedIncomes->total(),
                'from' => $paginatedIncomes->firstItem(),
                'to' => $paginatedIncomes->lastItem(),
            ],
            'manualIncomeSummary' => [
                'total_entries' => ManualIncome::query()->count(),
                'total_amount' => (float) ManualIncome::query()->sum('amount'),
                'filtered_entries' => $paginatedIncomes->total(),
                'filtered_amount' => (float) (clone $query)->sum('amount'),
            ],
            'categoryOptions' => collect(ManualIncomeCategories::options())
                ->map(fn (string $label, string $value) => [
                    'value' => $value,
                    'label' => $label,
                ])
                ->values(),
            'defaultRecordedAt' => now()->format('Y-m-d\TH:i'),
        ]);
    }

    public function store(StoreManualIncomeRequest $request): RedirectResponse
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $validated = $request->validated();
        $recordedAt = Carbon::parse($validated['recorded_at']);

        ManualIncome::query()->create([
            'income_no' => $this->generateIncomeNumber($recordedAt),
            'recorded_at' => $recordedAt,
            'recorded_by' => $actor->id,
            'category' => $validated['category'],
            'title' => $validated['title'],
            'amount' => $validated['amount'],
            'notes' => $validated['notes'] ?? null,
        ]);

        return to_route('admin.manual-incomes.index')->with('success', 'Pemasukan manual berhasil dicatat.');
    }

    private function generateIncomeNumber(Carbon $recordedAt): string
    {
        $prefix = 'ROC-MAN-'.$recordedAt->format('Ymd');
        $lastIncomeNumber = ManualIncome::query()
            ->where('income_no', 'like', $prefix.'-%')
            ->latest('income_no')
            ->value('income_no');

        $nextSequence = 1;

        if (is_string($lastIncomeNumber) && preg_match('/(\d+)$/', $lastIncomeNumber, $matches) === 1) {
            $nextSequence = ((int) $matches[1]) + 1;
        }

        return sprintf('%s-%04d', $prefix, $nextSequence);
    }
}
