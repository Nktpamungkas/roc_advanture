<?php

namespace App\Http\Requests\Admin;

use App\Support\Finance\ManualIncomeCategories;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreManualIncomeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'recorded_at' => ['required', 'date'],
            'category' => ['required', 'string', Rule::in(ManualIncomeCategories::values())],
            'title' => ['required', 'string', 'max:150'],
            'amount' => ['required', 'numeric', 'min:1'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
