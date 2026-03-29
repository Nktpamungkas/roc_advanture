<?php

namespace App\Http\Requests\Admin;

use App\Services\UserManagementService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(UserManagementService $userManagementService): bool
    {
        return $this->user() !== null && $userManagementService->canAccessUserManagement($this->user());
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(UserManagementService $userManagementService): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', 'string', Rule::in($userManagementService->assignableRoles($this->user()))],
            'is_active' => ['required', 'boolean'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ];
    }
}
