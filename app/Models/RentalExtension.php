<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalExtension extends Model
{
    use HasFactory;

    protected $fillable = [
        'rental_id',
        'extended_by',
        'payment_method_config_id',
        'previous_due_at',
        'new_due_at',
        'previous_total_days',
        'new_total_days',
        'previous_subtotal',
        'new_subtotal',
        'extension_payment_amount',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'previous_due_at' => 'datetime',
            'new_due_at' => 'datetime',
            'previous_subtotal' => 'decimal:2',
            'new_subtotal' => 'decimal:2',
            'extension_payment_amount' => 'decimal:2',
        ];
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class);
    }

    public function extendedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'extended_by');
    }

    public function paymentMethodConfig(): BelongsTo
    {
        return $this->belongsTo(PaymentMethodConfig::class);
    }
}
