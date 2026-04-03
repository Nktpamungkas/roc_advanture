<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_extensions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rental_id')->constrained()->cascadeOnDelete();
            $table->foreignId('extended_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('payment_method_config_id')->nullable()->constrained('payment_method_configs')->nullOnDelete();
            $table->dateTime('previous_due_at');
            $table->dateTime('new_due_at');
            $table->unsignedInteger('previous_total_days');
            $table->unsignedInteger('new_total_days');
            $table->decimal('previous_subtotal', 14, 2);
            $table->decimal('new_subtotal', 14, 2);
            $table->decimal('extension_payment_amount', 14, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_extensions');
    }
};
