<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\TransactionalDataPurgeService;
use App\Services\WhatsappService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('whatsapp:send-rental-reminders', function (WhatsappService $whatsappService) {
    $sentCount = $whatsappService->sendDueRentalReminders();

    $this->info("Reminder WA terkirim: {$sentCount}");
})->purpose('Kirim reminder WhatsApp otomatis untuk rental yang mendekati jatuh tempo');

Artisan::command('app:purge-transactions {--force : Eksekusi penghapusan data transaksi} {--dry-run : Tampilkan pratinjau tanpa menghapus data}', function (TransactionalDataPurgeService $purgeService) {
    $preview = $purgeService->preview();

    $this->line('');
    $this->info('Master tables yang dipertahankan:');

    foreach ($preview['master_tables'] as $table) {
        $this->line(" - {$table}");
    }

    $this->line('');
    $this->warn('Transactional tables yang akan dihapus:');

    foreach ($preview['transactional_tables'] as $table) {
        $count = $preview['table_counts'][$table] ?? 0;
        $this->line(sprintf(' - %s (%d rows)', $table, $count));
    }

    if ($this->option('dry-run')) {
        $this->info('Dry run selesai. Tidak ada data yang dihapus.');

        return;
    }

    if (! $this->option('force') && ! $this->confirm('Lanjut hapus data transaksi dan pertahankan master data?')) {
        $this->warn('Dibatalkan.');

        return;
    }

    $result = $purgeService->purge();

    $this->line('');
    $this->info('Penghapusan selesai.');
    $this->info('Total rows terhapus: '.$result['deleted_total']);

    foreach ($result['deleted_rows'] as $table => $count) {
        $this->line(sprintf(' - %s: %d rows', $table, $count));
    }
})->purpose('Hapus semua data transaksi dan pertahankan data master');

Schedule::command('whatsapp:send-rental-reminders')->everyMinute();
