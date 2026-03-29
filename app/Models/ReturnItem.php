<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'return_id',
        'rental_item_id',
        'replacement_unit_id',
        'return_condition',
        'next_unit_status',
        'compensation_type',
        'compensation_amount',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'compensation_amount' => 'decimal:2',
        ];
    }

    public function returnRecord(): BelongsTo
    {
        return $this->belongsTo(RentalReturn::class, 'return_id');
    }

    public function rentalItem(): BelongsTo
    {
        return $this->belongsTo(RentalItem::class);
    }

    public function replacementUnit(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class, 'replacement_unit_id');
    }
}
