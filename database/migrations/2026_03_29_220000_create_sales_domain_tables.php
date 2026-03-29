<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_products', function (Blueprint $table): void {
            $table->id();
            $table->string('sku')->unique();
            $table->string('name');
            $table->string('category')->nullable();
            $table->decimal('purchase_price', 12, 2)->default(0);
            $table->decimal('selling_price', 12, 2)->default(0);
            $table->unsignedInteger('stock_qty')->default(0);
            $table->unsignedInteger('min_stock_qty')->default(0);
            $table->boolean('active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_receipts', function (Blueprint $table): void {
            $table->id();
            $table->string('receipt_no')->unique();
            $table->string('supplier_name')->nullable();
            $table->dateTime('received_at');
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_receipt_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('stock_receipt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_product_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('product_name_snapshot');
            $table->string('sku_snapshot');
            $table->decimal('purchase_price', 12, 2);
            $table->unsignedInteger('qty');
            $table->decimal('line_total', 12, 2);
            $table->timestamps();
        });

        Schema::create('sales', function (Blueprint $table): void {
            $table->id();
            $table->string('sale_no')->unique();
            $table->dateTime('sold_at');
            $table->foreignId('sold_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->foreignId('payment_method_config_id')->nullable()->constrained()->nullOnDelete();
            $table->string('payment_method_name_snapshot')->nullable();
            $table->string('payment_method_type_snapshot')->nullable();
            $table->string('payment_qr_image_path_snapshot')->nullable();
            $table->string('payment_transfer_bank_snapshot')->nullable();
            $table->string('payment_transfer_account_number_snapshot')->nullable();
            $table->string('payment_transfer_account_name_snapshot')->nullable();
            $table->text('payment_instruction_snapshot')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_product_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('product_name_snapshot');
            $table->string('sku_snapshot');
            $table->decimal('selling_price_snapshot', 12, 2);
            $table->unsignedInteger('qty');
            $table->decimal('line_total', 12, 2);
            $table->timestamps();
        });

        Schema::create('stock_movements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_product_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('reference_type');
            $table->unsignedBigInteger('reference_id');
            $table->string('movement_type');
            $table->integer('qty');
            $table->unsignedInteger('stock_before');
            $table->unsignedInteger('stock_after');
            $table->dateTime('happened_at');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('stock_receipt_items');
        Schema::dropIfExists('stock_receipts');
        Schema::dropIfExists('sale_products');
    }
};
