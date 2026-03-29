<?php

use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\InventoryUnitController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\SeasonRuleController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::get('products', [ProductController::class, 'index'])->name('products.index');
        Route::post('products', [ProductController::class, 'store'])->name('products.store');
        Route::patch('products/{product}', [ProductController::class, 'update'])->name('products.update');

        Route::get('inventory-units', [InventoryUnitController::class, 'index'])->name('inventory-units.index');
        Route::post('inventory-units', [InventoryUnitController::class, 'store'])->name('inventory-units.store');
        Route::patch('inventory-units/{inventoryUnit}', [InventoryUnitController::class, 'update'])->name('inventory-units.update');

        Route::get('customers', [CustomerController::class, 'index'])->name('customers.index');
        Route::post('customers', [CustomerController::class, 'store'])->name('customers.store');
        Route::patch('customers/{customer}', [CustomerController::class, 'update'])->name('customers.update');

        Route::get('season-rules', [SeasonRuleController::class, 'index'])->name('season-rules.index');
        Route::post('season-rules', [SeasonRuleController::class, 'store'])->name('season-rules.store');
        Route::patch('season-rules/{seasonRule}', [SeasonRuleController::class, 'update'])->name('season-rules.update');

        Route::get('users', [UserController::class, 'index'])->name('users.index');
        Route::post('users', [UserController::class, 'store'])->name('users.store');
        Route::patch('users/{user}', [UserController::class, 'update'])->name('users.update');
    });
