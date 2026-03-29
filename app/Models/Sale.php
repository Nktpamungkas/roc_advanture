<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_no',
        'sold_at',
        'sold_by',
        'customer_name',
        'customer_phone',
        'subtotal',
        'discount_amount',
        'total_amount',
        'payment_method_config_id',
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
            'sold_at' => 'datetime',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function soldBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sold_by');
    }

    public function paymentMethodConfig(): BelongsTo
    {
        return $this->belongsTo(PaymentMethodConfig::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }
}
