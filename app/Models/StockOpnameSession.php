<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockOpnameSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'opname_no',
        'domain',
        'performed_at',
        'created_by',
        'total_items',
        'discrepancy_count',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'performed_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function saleItems(): HasMany
    {
        return $this->hasMany(StockOpnameSaleItem::class);
    }

    public function rentalItems(): HasMany
    {
        return $this->hasMany(StockOpnameRentalItem::class);
    }
}
