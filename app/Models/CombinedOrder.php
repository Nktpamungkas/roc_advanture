<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CombinedOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'combined_no',
        'ordered_at',
        'created_by',
        'customer_name',
        'customer_phone',
        'payment_method_config_id',
        'rental_total',
        'sale_total',
        'subtotal',
        'discount_amount',
        'paid_amount',
        'remaining_amount',
        'payment_status',
        'payment_method_name_snapshot',
        'payment_method_type_snapshot',
        'payment_qr_image_path_snapshot',
        'payment_transfer_bank_snapshot',
        'payment_transfer_account_number_snapshot',
        'payment_transfer_account_name_snapshot',
        'payment_instruction_snapshot',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'ordered_at' => 'datetime',
            'rental_total' => 'decimal:2',
            'sale_total' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function paymentMethodConfig(): BelongsTo
    {
        return $this->belongsTo(PaymentMethodConfig::class);
    }

    public function rentals(): HasMany
    {
        return $this->hasMany(Rental::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
