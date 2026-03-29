<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpsertSeasonRuleRequest;
use App\Models\SeasonRule;
use App\Services\AdminAccessService;
use App\Support\Rental\SeasonDpTypes;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class SeasonRuleController extends Controller
{
    public function __construct(
        private readonly AdminAccessService $adminAccessService,
    ) {
    }

    public function index(): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        $seasonRules = SeasonRule::query()
            ->orderByDesc('start_date')
            ->get()
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
