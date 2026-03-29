<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpsertSeasonRuleRequest;
use App\Models\SeasonRule;
use App\Services\AdminAccessService;
use App\Support\Rental\SeasonDpTypes;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SeasonRuleController extends Controller
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
            'dp_required' => (string) $request->input('dp_required', ''),
            'per_page' => in_array($request->integer('per_page', 10), [10, 15, 25, 50], true)
                ? $request->integer('per_page', 10)
                : 10,
        ];

        $seasonRuleQuery = SeasonRule::query()
            ->when($filters['search'] !== '', fn ($query) => $query->where('name', 'like', '%'.$filters['search'].'%'))
            ->when($filters['status'] !== '', fn ($query) => $query->where('active', $filters['status'] === 'active'))
            ->when($filters['dp_required'] !== '', fn ($query) => $query->where('dp_required', $filters['dp_required'] === 'required'))
            ->orderByDesc('start_date')
            ->paginate($filters['per_page'])
            ->withQueryString();

        $seasonRules = $seasonRuleQuery->getCollection()
            ->map(fn (SeasonRule $seasonRule) => [
                'id' => $seasonRule->id,
                'name' => $seasonRule->name,
                'start_date' => $seasonRule->start_date?->format('Y-m-d'),
                'end_date' => $seasonRule->end_date?->format('Y-m-d'),
                'dp_required' => (bool) $seasonRule->dp_required,
                'dp_type' => $seasonRule->dp_type,
                'dp_value' => $seasonRule->dp_value !== null ? (string) $seasonRule->dp_value : null,
                'active' => (bool) $seasonRule->active,
                'notes' => $seasonRule->notes,
            ])
            ->values();

        return Inertia::render('admin/season-rules/index', [
            'seasonRules' => $seasonRules,
            'seasonRuleFilters' => $filters,
            'seasonRulePagination' => [
                'current_page' => $seasonRuleQuery->currentPage(),
                'last_page' => $seasonRuleQuery->lastPage(),
                'per_page' => $seasonRuleQuery->perPage(),
                'total' => $seasonRuleQuery->total(),
                'from' => $seasonRuleQuery->firstItem(),
                'to' => $seasonRuleQuery->lastItem(),
            ],
            'seasonRuleSummary' => [
                'total_rules' => SeasonRule::query()->count(),
                'active_rules' => SeasonRule::query()->where('active', true)->count(),
                'dp_required_rules' => SeasonRule::query()->where('dp_required', true)->count(),
                'filtered_rules' => $seasonRuleQuery->total(),
            ],
            'dpTypeOptions' => SeasonDpTypes::options(),
        ]);
    }

    public function store(UpsertSeasonRuleRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        SeasonRule::create([
            ...$validated,
            'dp_type' => $validated['dp_required'] ? $validated['dp_type'] : null,
            'dp_value' => $validated['dp_required'] ? $validated['dp_value'] : null,
        ]);

        return to_route('admin.season-rules.index')->with('success', 'Aturan season berhasil dibuat.');
    }

    public function update(UpsertSeasonRuleRequest $request, SeasonRule $seasonRule): RedirectResponse
    {
        $validated = $request->validated();

        $seasonRule->update([
            ...$validated,
            'dp_type' => $validated['dp_required'] ? $validated['dp_type'] : null,
            'dp_value' => $validated['dp_required'] ? $validated['dp_value'] : null,
        ]);

        return to_route('admin.season-rules.index')->with('success', 'Aturan season berhasil diperbarui.');
    }
}
