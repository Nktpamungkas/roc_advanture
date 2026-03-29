<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'sale_product_id',
        'product_name_snapshot',
        'sku_snapshot',
        'selling_price_snapshot',
        'qty',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'selling_price_snapshot' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function saleProduct(): BelongsTo
    {
        return $this->belongsTo(SaleProduct::class);
    }
}
