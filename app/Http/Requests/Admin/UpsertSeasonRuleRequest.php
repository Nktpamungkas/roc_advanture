<?php

namespace App\Http\Requests\Admin;

use App\Services\AdminAccessService;
use App\Support\Rental\SeasonDpTypes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpsertSeasonRuleRequest extends FormRequest
{
    public function authorize(AdminAccessService $adminAccessService): bool
    {
        return $this->user() !== null && $adminAccessService->canAccessBackOffice($this->user());
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'dp_required' => ['required', 'boolean'],
            'dp_type' => [
                Rule::requiredIf($this->boolean('dp_required')),
                'nullable',
                'string',
                Rule::in(SeasonDpTypes::all()),
            ],
            'dp_value' => [
                Rule::requiredIf($this->boolean('dp_required')),
                'nullable',
                'numeric',
                'min:0',
            ],
            'active' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->boolean('dp_required') || $this->input('dp_type') !== SeasonDpTypes::PERCENTAGE) {
                return;
            }

            if ((float) $this->input('dp_value', 0) > 100) {
                $validator->errors()->add('dp_value', 'Persentase DP tidak boleh lebih dari 100%.');
            }
        });
    }
}
