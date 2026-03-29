<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_product_id',
        'reference_type',
        'reference_id',
        'movement_type',
        'qty',
        'stock_before',
        'stock_after',
        'happened_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'happened_at' => 'datetime',
        ];
    }

    public function saleProduct(): BelongsTo
    {
        return $this->belongsTo(SaleProduct::class);
    }
}
