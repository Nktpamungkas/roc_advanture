<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'rental_id',
        'received_by',
        'payment_method_config_id',
        'gateway_provider',
        'gateway_transaction_id',
        'gateway_order_id',
        'gateway_status',
        'gateway_fraud_status',
        'payment_kind',
        'amount',
        'paid_at',
        'method',
        'method_label_snapshot',
        'method_type_snapshot',
        'instructions_snapshot',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class);
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function paymentMethodConfig(): BelongsTo
    {
        return $this->belongsTo(PaymentMethodConfig::class);
    }
}
