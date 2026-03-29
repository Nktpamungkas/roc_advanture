<?php

use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        // Role-based admin routes will be added after the workflow is approved.
    });
