<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('combined_orders', function (Blueprint $table): void {
            $table->id();
            $table->string('combined_no')->unique();
            $table->dateTime('ordered_at');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->foreignId('payment_method_config_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('rental_total', 12, 2)->default(0);
            $table->decimal('sale_total', 12, 2)->default(0);
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('remaining_amount', 12, 2)->default(0);
            $table->string('payment_status')->default('unpaid');
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

        Schema::table('rentals', function (Blueprint $table): void {
            $table->foreignId('combined_order_id')
                ->nullable()
                ->after('season_rule_id')
                ->constrained('combined_orders')
                ->nullOnDelete();
        });

        Schema::table('sales', function (Blueprint $table): void {
            $table->foreignId('combined_order_id')
                ->nullable()
                ->after('sold_by')
                ->constrained('combined_orders')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('combined_order_id');
        });

        Schema::table('rentals', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('combined_order_id');
        });

        Schema::dropIfExists('combined_orders');
    }
};
