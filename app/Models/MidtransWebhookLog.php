<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MidtransWebhookLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'provider',
        'order_id',
        'transaction_id',
        'transaction_status',
        'status_code',
        'fraud_status',
        'payment_type',
        'gross_amount',
        'currency',
        'signature_valid',
        'target_type',
        'target_key',
        'payload',
        'processed_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'gross_amount' => 'decimal:2',
            'signature_valid' => 'boolean',
            'payload' => 'array',
            'processed_at' => 'datetime',
        ];
    }
}
