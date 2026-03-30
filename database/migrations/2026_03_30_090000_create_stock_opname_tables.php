<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_opname_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('opname_no')->unique();
            $table->string('domain', 20);
            $table->timestamp('performed_at');
            $table->foreignId('created_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->unsignedInteger('total_items')->default(0);
            $table->unsignedInteger('discrepancy_count')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_opname_sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_opname_session_id')->constrained('stock_opname_sessions')->cascadeOnDelete();
            $table->foreignId('sale_product_id')->nullable()->constrained('sale_products')->nullOnDelete();
            $table->string('sku_snapshot');
            $table->string('product_name_snapshot');
            $table->integer('system_qty');
            $table->integer('physical_qty');
            $table->integer('difference_qty');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_opname_rental_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_opname_session_id')->constrained('stock_opname_sessions')->cascadeOnDelete();
            $table->foreignId('inventory_unit_id')->nullable()->constrained('inventory_units')->nullOnDelete();
            $table->string('unit_code_snapshot');
            $table->string('product_name_snapshot')->nullable();
            $table->string('system_status', 50);
            $table->string('observed_status', 50);
            $table->boolean('is_discrepancy')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_opname_rental_items');
        Schema::dropIfExists('stock_opname_sale_items');
        Schema::dropIfExists('stock_opname_sessions');
    }
};
