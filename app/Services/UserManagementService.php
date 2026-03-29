<?php

namespace App\Services;

use App\Models\User;
use App\Support\Access\RoleNames;
use Illuminate\Database\Eloquent\Builder;

class UserManagementService
{
    public function canAccessUserManagement(User $actor): bool
    {
        return $actor->hasAnyRole([
            RoleNames::SUPER_ADMIN,
            RoleNames::ADMIN_TOKO,
        ]);
    }

    public function canManageTarget(User $actor, User $target): bool
    {
        if (! $this->canAccessUserManagement($actor)) {
            return false;
        }

        if ($actor->hasRole(RoleNames::SUPER_ADMIN)) {
            return true;
        }

        return $actor->hasRole(RoleNames::ADMIN_TOKO) && $target->hasRole(RoleNames::STAFF);
    }

    /**
     * @return list<string>
     */
    public function assignableRoles(User $actor): array
    {
        if ($actor->hasRole(RoleNames::SUPER_ADMIN)) {
            return RoleNames::all();
        }

        if ($actor->hasRole(RoleNames::ADMIN_TOKO)) {
            return [RoleNames::STAFF];
        }

        return [];
    }

    public function canAssignRole(User $actor, string $role): bool
    {
        return in_array($role, $this->assignableRoles($actor), true);
    }

    public function visibleUsersQuery(User $actor): Builder
    {
        $query = User::query()
            ->with('roles')
            ->orderBy('name');

        if ($actor->hasRole(RoleNames::SUPER_ADMIN)) {
            return $query;
        }

        return $query->whereHas('roles', function (Builder $builder): void {
            $builder->where('name', RoleNames::STAFF);
        });
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public function roleOptions(User $actor): array
    {
        return array_map(fn (string $role) => [
            'value' => $role,
            'label' => $this->labelForRole($role),
        ], $this->assignableRoles($actor));
    }

    /**
     * @return array{
     *     id: int,
     *     name: string,
     *     email: string,
     *     is_active: bool,
     *     role_names: list<string>,
     *     primary_role: ?string,
     *     created_at: ?string,
     *     updated_at: ?string
     * }
     */
    public function serializeUser(User $user): array
    {
        $roleNames = $user->getRoleNames()->values()->all();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_active' => (bool) $user->is_active,
            'role_names' => $roleNames,
            'primary_role' => $roleNames[0] ?? null,
            'created_at' => $user->created_at?->toISOString(),
            'updated_at' => $user->updated_at?->toISOString(),
        ];
    }

    public function labelForRole(string $role): string
    {
        return match ($role) {
            RoleNames::SUPER_ADMIN => 'Super Admin',
            RoleNames::ADMIN_TOKO => 'Admin Toko',
            RoleNames::STAFF => 'Staff',
            default => $role,
        };
    }
}
