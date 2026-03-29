<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockReceiptItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_receipt_id',
        'sale_product_id',
        'product_name_snapshot',
        'sku_snapshot',
        'purchase_price',
        'qty',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'purchase_price' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function stockReceipt(): BelongsTo
    {
        return $this->belongsTo(StockReceipt::class);
    }

    public function saleProduct(): BelongsTo
    {
        return $this->belongsTo(SaleProduct::class);
    }
}
