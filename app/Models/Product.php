<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'category',
        'daily_rate',
        'active',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'daily_rate' => 'decimal:2',
        ];
    }

    public function inventoryUnits(): HasMany
    {
        return $this->hasMany(InventoryUnit::class);
    }
}
