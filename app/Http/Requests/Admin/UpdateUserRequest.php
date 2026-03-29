<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use App\Services\UserManagementService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UpdateUserRequest extends FormRequest
{
    public function authorize(UserManagementService $userManagementService): bool
    {
        $target = $this->route('user');

        return $this->user() !== null
            && $target instanceof User
            && $userManagementService->canManageTarget($this->user(), $target);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(UserManagementService $userManagementService): array
    {
        /** @var User $target */
        $target = $this->route('user');

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique('users', 'email')->ignore($target->id)],
            'role' => ['required', 'string', Rule::in($userManagementService->assignableRoles($this->user()))],
            'is_active' => ['required', 'boolean'],
        ];
    }

    /**
     * @throws ValidationException
     */
    public function ensureSafeSelfManagement(): void
    {
        /** @var User $target */
        $target = $this->route('user');

        if (! $this->user() || $this->user()->id !== $target->id) {
            return;
        }

        if (! $this->boolean('is_active')) {
            throw ValidationException::withMessages([
                'is_active' => 'Anda tidak bisa menonaktifkan akun yang sedang dipakai.',
            ]);
        }

        $currentRole = $target->getRoleNames()->first();

        if ($currentRole !== $this->string('role')->value()) {
            throw ValidationException::withMessages([
                'role' => 'Gunakan halaman profile untuk mengelola akun Anda sendiri.',
            ]);
        }
    }
}
