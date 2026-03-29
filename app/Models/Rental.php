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
        'created_by',
        'starts_at',
        'due_at',
        'total_days',
        'dp_required',
        'subtotal',
        'dp_amount',
        'paid_amount',
        'remaining_amount',
        'payment_status',
        'rental_status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'due_at' => 'datetime',
            'dp_required' => 'boolean',
            'subtotal' => 'decimal:2',
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
