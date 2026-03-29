<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use App\Services\RolePermissionBootstrapper;
use App\Services\UserManagementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function __construct(
        private readonly UserManagementService $userManagementService,
        private readonly RolePermissionBootstrapper $rolePermissionBootstrapper,
    ) {
    }

    public function index(): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->userManagementService->canAccessUserManagement($actor), 403);

        $this->rolePermissionBootstrapper->ensureRolesAndPermissions();

        $users = $this->userManagementService
            ->visibleUsersQuery($actor)
            ->get()
            ->map(fn (User $user) => $this->userManagementService->serializeUser($user))
            ->values();

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'roleOptions' => $this->userManagementService->roleOptions($actor),
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $this->rolePermissionBootstrapper->ensureRolesAndPermissions();

        $validated = $request->validated();

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'is_active' => (bool) $validated['is_active'],
        ]);

        $user->syncRoles([$validated['role']]);

        return to_route('admin.users.index')->with('success', 'User berhasil dibuat.');
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $request->ensureSafeSelfManagement();

        $validated = $request->validated();

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'is_active' => (bool) $validated['is_active'],
        ]);

        $user->syncRoles([$validated['role']]);

        return to_route('admin.users.index')->with('success', 'User berhasil diperbarui.');
    }
}
