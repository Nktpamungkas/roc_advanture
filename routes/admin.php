<?php

use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\InventoryUnitController;
use App\Http\Controllers\Admin\NotificationSettingController;
use App\Http\Controllers\Admin\PaymentMethodConfigController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\RentalReportController;
use App\Http\Controllers\Admin\RentalController;
use App\Http\Controllers\Admin\RentalReturnController;
use App\Http\Controllers\Admin\SaleController;
use App\Http\Controllers\Admin\SalesReportController;
use App\Http\Controllers\Admin\SaleProductController;
use App\Http\Controllers\Admin\SeasonRuleController;
use App\Http\Controllers\Admin\StockReceiptController;
use App\Http\Controllers\Admin\StockOpnameController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\WhatsappHistoryController;
use App\Http\Controllers\Admin\WashingController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::get('products', [ProductController::class, 'index'])->name('products.index');
        Route::post('products', [ProductController::class, 'store'])->name('products.store');
        Route::patch('products/{product}', [ProductController::class, 'update'])->name('products.update');

        Route::get('sale-products', [SaleProductController::class, 'index'])->name('sale-products.index');
        Route::post('sale-products', [SaleProductController::class, 'store'])->name('sale-products.store');
        Route::patch('sale-products/{saleProduct}', [SaleProductController::class, 'update'])->name('sale-products.update');

        Route::get('inventory-units', [InventoryUnitController::class, 'index'])->name('inventory-units.index');
        Route::post('inventory-units', [InventoryUnitController::class, 'store'])->name('inventory-units.store');
        Route::post('inventory-units/generate', [InventoryUnitController::class, 'storeBulk'])->name('inventory-units.generate');
        Route::patch('inventory-units/{inventoryUnit}', [InventoryUnitController::class, 'update'])->name('inventory-units.update');
        Route::get('washing', [WashingController::class, 'index'])->name('washing.index');
        Route::post('washing', [WashingController::class, 'store'])->name('washing.store');

        Route::get('customers', [CustomerController::class, 'index'])->name('customers.index');
        Route::post('customers', [CustomerController::class, 'store'])->name('customers.store');
        Route::patch('customers/{customer}', [CustomerController::class, 'update'])->name('customers.update');

        Route::get('payment-methods', [PaymentMethodConfigController::class, 'index'])->name('payment-methods.index');
        Route::get('payment-methods/options', [PaymentMethodConfigController::class, 'options'])->name('payment-methods.options');
        Route::post('payment-methods', [PaymentMethodConfigController::class, 'store'])->name('payment-methods.store');
        Route::patch('payment-methods/{paymentMethodConfig}', [PaymentMethodConfigController::class, 'update'])->name('payment-methods.update');
        Route::get('notification-settings', [NotificationSettingController::class, 'index'])->name('notification-settings.index');
        Route::put('notification-settings', [NotificationSettingController::class, 'update'])->name('notification-settings.update');

        Route::get('season-rules', [SeasonRuleController::class, 'index'])->name('season-rules.index');
        Route::post('season-rules', [SeasonRuleController::class, 'store'])->name('season-rules.store');
        Route::patch('season-rules/{seasonRule}', [SeasonRuleController::class, 'update'])->name('season-rules.update');

        Route::get('rentals', [RentalController::class, 'index'])->name('rentals.index');
        Route::post('rentals', [RentalController::class, 'store'])->name('rentals.store');
        Route::get('rentals/{rental}', [RentalController::class, 'show'])->name('rentals.show');
        Route::post('rentals/{rental}/send-invoice-whatsapp', [RentalController::class, 'sendInvoiceWhatsapp'])->name('rentals.send-invoice-whatsapp');
        Route::get('stock-receipts', [StockReceiptController::class, 'index'])->name('stock-receipts.index');
        Route::post('stock-receipts', [StockReceiptController::class, 'store'])->name('stock-receipts.store');
        Route::get('stock-opname', [StockOpnameController::class, 'index'])->name('stock-opname.index');
        Route::post('stock-opname/sales', [StockOpnameController::class, 'storeSales'])->name('stock-opname.sales.store');
        Route::post('stock-opname/rentals', [StockOpnameController::class, 'storeRentals'])->name('stock-opname.rentals.store');
        Route::get('sales', [SaleController::class, 'index'])->name('sales.index');
        Route::post('sales', [SaleController::class, 'store'])->name('sales.store');
        Route::get('sales/{sale}', [SaleController::class, 'show'])->name('sales.show');
        Route::get('returns', [RentalReturnController::class, 'index'])->name('returns.index');
        Route::post('returns', [RentalReturnController::class, 'store'])->name('returns.store');
        Route::get('reports', fn () => to_route('admin.rental-reports.index'))->name('reports.index');
        Route::get('reports/rentals', [RentalReportController::class, 'index'])->name('rental-reports.index');
        Route::get('reports/rentals/export/{report}', [RentalReportController::class, 'export'])->name('rental-reports.export');
        Route::get('reports/sales', [SalesReportController::class, 'index'])->name('sales-reports.index');
        Route::get('reports/sales/export/{report}', [SalesReportController::class, 'export'])->name('sales-reports.export');
        Route::get('whatsapp-history', [WhatsappHistoryController::class, 'index'])->name('whatsapp-history.index');
        Route::delete('whatsapp-history/delete-selected', [WhatsappHistoryController::class, 'destroySelected'])->name('whatsapp-history.destroy-selected');
        Route::delete('whatsapp-history/delete-all', [WhatsappHistoryController::class, 'destroyAll'])->name('whatsapp-history.destroy-all');
        Route::delete('whatsapp-history/{waLog}', [WhatsappHistoryController::class, 'destroy'])->name('whatsapp-history.destroy');

        Route::get('users', [UserController::class, 'index'])->name('users.index');
        Route::post('users', [UserController::class, 'store'])->name('users.store');
        Route::patch('users/{user}', [UserController::class, 'update'])->name('users.update');
    });
