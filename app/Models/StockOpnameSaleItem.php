<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockOpnameSaleItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_opname_session_id',
        'sale_product_id',
        'sku_snapshot',
        'product_name_snapshot',
        'system_qty',
        'physical_qty',
        'difference_qty',
        'notes',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(StockOpnameSession::class, 'stock_opname_session_id');
    }

    public function saleProduct(): BelongsTo
    {
        return $this->belongsTo(SaleProduct::class);
    }
}
