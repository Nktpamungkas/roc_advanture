<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class RentalItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'rental_id',
        'inventory_unit_id',
        'product_name_snapshot',
        'daily_rate_snapshot',
        'days',
        'line_total',
        'status_at_checkout',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'daily_rate_snapshot' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class);
    }

    public function inventoryUnit(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class);
    }

    public function returnItem(): HasOne
    {
        return $this->hasOne(ReturnItem::class);
    }
}
