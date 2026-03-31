<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateWhatsappReminderSettingRequest;
use App\Services\AdminAccessService;
use App\Services\AppSettingService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class NotificationSettingController extends Controller
{
    public const RENTAL_REMINDER_ENABLED_KEY = 'whatsapp_rental_reminder_enabled';
    public const RENTAL_REMINDER_LEAD_HOURS_KEY = 'whatsapp_rental_reminder_lead_hours';
    public const RENTAL_REMINDER_TEMPLATE_KEY = 'whatsapp_rental_reminder_template';
    public const OVERDUE_REMINDER_ENABLED_KEY = 'whatsapp_overdue_reminder_enabled';
    public const OVERDUE_REMINDER_DELAY_HOURS_KEY = 'whatsapp_overdue_reminder_delay_hours';
    public const OVERDUE_REMINDER_TEMPLATE_KEY = 'whatsapp_overdue_reminder_template';

    public function __construct(
        private readonly AdminAccessService $adminAccessService,
        private readonly AppSettingService $appSettingService,
    ) {
    }

    public function index(): Response
    {
        $actor = auth()->user();

        abort_unless($actor !== null && $this->adminAccessService->canAccessBackOffice($actor), 403);

        return Inertia::render('admin/notification-settings/index', [
            'notificationSettings' => $this->resolveSettingsPayload(),
        ]);
    }

    public function update(UpdateWhatsappReminderSettingRequest $request): RedirectResponse
    {
        $this->appSettingService->put(
            self::RENTAL_REMINDER_ENABLED_KEY,
            $request->boolean('rental_reminder_enabled'),
        );
        $this->appSettingService->put(
            self::RENTAL_REMINDER_LEAD_HOURS_KEY,
            $request->integer('rental_reminder_lead_hours'),
        );
        $this->appSettingService->put(
            self::RENTAL_REMINDER_TEMPLATE_KEY,
            $request->string('rental_reminder_template')->toString(),
        );
        $this->appSettingService->put(
            self::OVERDUE_REMINDER_ENABLED_KEY,
            $request->boolean('overdue_reminder_enabled'),
        );
        $this->appSettingService->put(
            self::OVERDUE_REMINDER_DELAY_HOURS_KEY,
            $request->integer('overdue_reminder_delay_hours'),
        );
        $this->appSettingService->put(
            self::OVERDUE_REMINDER_TEMPLATE_KEY,
            $request->string('overdue_reminder_template')->toString(),
        );

        return to_route('admin.notification-settings.index')->with('success', 'Pengaturan reminder WhatsApp berhasil diperbarui.');
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveSettingsPayload(): array
    {
        $defaultLeadHours = max(1, (int) config('services.whatsapp.rental_reminder_lead_hours', 6));
        $defaultOverdueDelayHours = 2;

        return [
            'rental_reminder_enabled' => $this->appSettingService->getBool(self::RENTAL_REMINDER_ENABLED_KEY, true),
            'rental_reminder_lead_hours' => max(
                1,
                $this->appSettingService->getInt(self::RENTAL_REMINDER_LEAD_HOURS_KEY, $defaultLeadHours),
            ),
            'rental_reminder_template' => $this->appSettingService->getString(
                self::RENTAL_REMINDER_TEMPLATE_KEY,
                self::defaultRentalReminderTemplate(),
            ),
            'overdue_reminder_enabled' => $this->appSettingService->getBool(self::OVERDUE_REMINDER_ENABLED_KEY, false),
            'overdue_reminder_delay_hours' => max(
                1,
                $this->appSettingService->getInt(self::OVERDUE_REMINDER_DELAY_HOURS_KEY, $defaultOverdueDelayHours),
            ),
            'overdue_reminder_template' => $this->appSettingService->getString(
                self::OVERDUE_REMINDER_TEMPLATE_KEY,
                self::defaultOverdueReminderTemplate(),
            ),
            'default_rental_reminder_lead_hours' => $defaultLeadHours,
            'default_overdue_reminder_delay_hours' => $defaultOverdueDelayHours,
            'placeholders' => [
                '{customer_name}',
                '{rental_no}',
                '{starts_at}',
                '{due_at}',
                '{items}',
                '{subtotal}',
                '{remaining_amount}',
                '{guarantee_note}',
                '{admin_name}',
                '{store_name}',
            ],
        ];
    }

    public static function defaultRentalReminderTemplate(): string
    {
        return implode("\n", [
            'Halo {customer_name},',
            'Ini pengingat pengembalian sewa dari {store_name}.',
            'No Rental: {rental_no}',
            'Batas kembali: {due_at}',
            '',
            'Item Sewa:',
            '{items}',
            '',
            'Sisa Tagihan: {remaining_amount}',
            'Mohon barang dikembalikan tepat waktu. Terima kasih.',
        ]);
    }

    public static function defaultOverdueReminderTemplate(): string
    {
        return implode("\n", [
            'Halo {customer_name},',
            'Rental {rental_no} dari {store_name} sudah melewati batas pengembalian.',
            'Batas kembali: {due_at}',
            '',
            'Item Sewa:',
            '{items}',
            '',
            'Sisa Tagihan: {remaining_amount}',
            'Mohon segera menghubungi toko dan mengembalikan barang secepatnya.',
        ]);
    }
}
