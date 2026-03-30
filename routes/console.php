<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\WhatsappService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('whatsapp:send-rental-reminders', function (WhatsappService $whatsappService) {
    $sentCount = $whatsappService->sendDueRentalReminders();

    $this->info("Reminder WA terkirim: {$sentCount}");
})->purpose('Kirim reminder WhatsApp otomatis untuk rental yang mendekati jatuh tempo');

Schedule::command('whatsapp:send-rental-reminders')->everyFiveMinutes();
