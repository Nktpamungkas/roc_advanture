<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class PaymentMethodAssetService
{
    public function storeQrImage(UploadedFile $file): string
    {
        $directory = public_path('uploads/payment-methods');

        if (! is_dir($directory)) {
            mkdir($directory, 0777, true);
        }

        $filename = now()->format('YmdHis').'-'.Str::random(10).'.'.$file->getClientOriginalExtension();
        $file->move($directory, $filename);

        return '/uploads/payment-methods/'.$filename;
    }

    public function deleteIfExists(?string $path): void
    {
        if (blank($path) || ! str_starts_with($path, '/uploads/payment-methods/')) {
            return;
        }

        $absolutePath = public_path(ltrim($path, '/'));

        if (is_file($absolutePath)) {
            unlink($absolutePath);
        }
    }
}
