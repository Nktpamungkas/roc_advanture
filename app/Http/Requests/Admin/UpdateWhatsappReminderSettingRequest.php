<?php

namespace App\Http\Requests\Admin;

use App\Services\AdminAccessService;
use Illuminate\Foundation\Http\FormRequest;

class UpdateWhatsappReminderSettingRequest extends FormRequest
{
    public function authorize(AdminAccessService $adminAccessService): bool
    {
        return $this->user() !== null && $adminAccessService->canAccessBackOffice($this->user());
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'rental_reminder_enabled' => $this->boolean('rental_reminder_enabled'),
            'overdue_reminder_enabled' => $this->boolean('overdue_reminder_enabled'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'rental_reminder_enabled' => ['required', 'boolean'],
            'rental_reminder_lead_hours' => ['required', 'integer', 'min:1', 'max:168'],
            'rental_reminder_template' => ['required', 'string', 'max:5000'],
            'overdue_reminder_enabled' => ['required', 'boolean'],
            'overdue_reminder_delay_hours' => ['required', 'integer', 'min:1', 'max:168'],
            'overdue_reminder_template' => ['required', 'string', 'max:5000'],
        ];
    }
}
