<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('midtrans_webhook_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('provider')->default('midtrans');
            $table->string('order_id')->nullable()->index();
            $table->string('transaction_id')->nullable()->unique();
            $table->string('transaction_status')->nullable()->index();
            $table->string('status_code')->nullable()->index();
            $table->string('fraud_status')->nullable();
            $table->string('payment_type')->nullable();
            $table->decimal('gross_amount', 14, 2)->nullable();
            $table->string('currency', 10)->nullable();
            $table->boolean('signature_valid')->default(false);
            $table->string('target_type')->nullable()->index();
            $table->string('target_key')->nullable()->index();
            $table->json('payload')->nullable();
            $table->dateTime('processed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('midtrans_webhook_logs');
    }
};
