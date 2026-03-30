<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockOpnameRentalItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_opname_session_id',
        'inventory_unit_id',
        'unit_code_snapshot',
        'product_name_snapshot',
        'system_status',
        'observed_status',
        'is_discrepancy',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_discrepancy' => 'boolean',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(StockOpnameSession::class, 'stock_opname_session_id');
    }

    public function inventoryUnit(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class);
    }
}
