<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Rental extends Model
{
    use HasFactory;

    protected $fillable = [
        'rental_no',
        'customer_id',
        'season_rule_id',
        'payment_method_config_id',
        'payment_method_name_snapshot',
        'payment_method_type_snapshot',
        'payment_qr_image_path_snapshot',
        'payment_transfer_bank_snapshot',
        'payment_transfer_account_number_snapshot',
        'payment_transfer_account_name_snapshot',
        'payment_instruction_snapshot',
        'created_by',
        'starts_at',
        'due_at',
        'total_days',
        'final_total_days',
        'dp_required',
        'subtotal',
        'final_subtotal',
        'dp_amount',
        'dp_override_reason',
        'paid_amount',
        'remaining_amount',
        'payment_status',
        'settlement_basis',
        'rental_status',
        'notes',
        'guarantee_note',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'due_at' => 'datetime',
            'dp_required' => 'boolean',
            'subtotal' => 'decimal:2',
            'final_subtotal' => 'decimal:2',
            'dp_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function seasonRule(): BelongsTo
    {
        return $this->belongsTo(SeasonRule::class);
    }

    public function paymentMethodConfig(): BelongsTo
    {
        return $this->belongsTo(PaymentMethodConfig::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(RentalItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function returnRecord(): HasOne
    {
        return $this->hasOne(RentalReturn::class, 'rental_id');
    }

    public function waLogs(): HasMany
    {
        return $this->hasMany(WaLog::class);
    }
}
