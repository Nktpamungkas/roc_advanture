<?php

namespace App\Services;

use App\Models\Rental;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Process\Process;

class RentalInvoicePdfService
{
    public function render(Rental $rental): string
    {
        $rental->loadMissing([
            'customer',
            'creator',
            'items.inventoryUnit',
            'payments.receiver',
        ]);

        $temporaryDirectory = storage_path('app/tmp');
        File::ensureDirectoryExists($temporaryDirectory);

        $token = (string) Str::uuid();
        $htmlPath = $temporaryDirectory.DIRECTORY_SEPARATOR.$token.'.html';
        $pdfPath = $temporaryDirectory.DIRECTORY_SEPARATOR.$token.'.pdf';
        $userDataDirectory = $temporaryDirectory.DIRECTORY_SEPARATOR.'browser-'.$token;

        File::ensureDirectoryExists($userDataDirectory);

        $html = View::make('pdf.rental-invoice', [
            'rental' => $rental,
            'logoDataUri' => $this->imageToDataUri(public_path('images/roc-advanture-logo-circle.png')),
            'paymentQrDataUri' => $this->publicAssetToDataUri($rental->payment_qr_image_path_snapshot),
        ])->render();

        file_put_contents($htmlPath, $html);

        try {
            $process = new Process([
                $this->resolveBrowserBinary(),
                '--headless',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-crash-reporter',
                '--allow-file-access-from-files',
                '--no-first-run',
                '--no-default-browser-check',
                '--user-data-dir='.$userDataDirectory,
                '--no-pdf-header-footer',
                '--print-to-pdf='.$pdfPath,
                $this->fileUri($htmlPath),
            ]);

            $process->setTimeout((int) config('services.pdf_renderer.timeout', 30));
            $process->run();

            if (! $process->isSuccessful() || ! is_file($pdfPath)) {
                Log::error('Rental invoice PDF render failed.', [
                    'rental_id' => $rental->id,
                    'rental_no' => $rental->rental_no,
                    'browser_binary' => $this->resolveBrowserBinary(),
                    'exit_code' => $process->getExitCode(),
                    'error_output' => $process->getErrorOutput(),
                    'output' => $process->getOutput(),
                ]);

                throw new RuntimeException('Gagal membuat PDF invoice untuk dikirim ke WhatsApp.');
            }

            $pdfContents = file_get_contents($pdfPath);

            if ($pdfContents === false) {
                throw new RuntimeException('PDF invoice berhasil dibuat, tetapi file-nya tidak bisa dibaca.');
            }

            return $pdfContents;
        } finally {
            if (is_file($htmlPath)) {
                unlink($htmlPath);
            }

            if (is_file($pdfPath)) {
                unlink($pdfPath);
            }

            if (is_dir($userDataDirectory)) {
                File::deleteDirectory($userDataDirectory);
            }
        }
    }

    public function filename(Rental $rental): string
    {
        return 'invoice-sewa-'.Str::slug(Str::lower($rental->rental_no)).'.pdf';
    }

    private function publicAssetToDataUri(?string $path): ?string
    {
        if (blank($path)) {
            return null;
        }

        return $this->imageToDataUri(public_path(ltrim((string) $path, '/')));
    }

    private function imageToDataUri(?string $absolutePath): ?string
    {
        if (blank($absolutePath) || ! is_file($absolutePath)) {
            return null;
        }

        $mimeType = mime_content_type($absolutePath);
        $contents = file_get_contents($absolutePath);

        if ($mimeType === false || $contents === false) {
            return null;
        }

        return 'data:'.$mimeType.';base64,'.base64_encode($contents);
    }

    private function resolveBrowserBinary(): string
    {
        $configuredBinary = config('services.pdf_renderer.browser_binary');

        if (filled($configuredBinary) && is_file((string) $configuredBinary)) {
            return (string) $configuredBinary;
        }

        $fallbackCandidates = [
            'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
            'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
            'C:\Program Files\Google\Chrome\Application\chrome.exe',
        ];

        foreach ($fallbackCandidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        throw new RuntimeException('Browser headless untuk generate PDF belum ditemukan. Set PDF_BROWSER_BINARY di file .env.');
    }

    private function fileUri(string $path): string
    {
        return 'file:///'.str_replace(' ', '%20', str_replace('\\', '/', $path));
    }
}
