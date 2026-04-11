<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->string('gateway_provider')->nullable()->after('payment_method_config_id');
            $table->string('gateway_transaction_id')->nullable()->unique()->after('gateway_provider');
            $table->string('gateway_order_id')->nullable()->index()->after('gateway_transaction_id');
            $table->string('gateway_status')->nullable()->after('gateway_order_id');
            $table->string('gateway_fraud_status')->nullable()->after('gateway_status');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropUnique(['gateway_transaction_id']);
            $table->dropIndex(['gateway_order_id']);
            $table->dropColumn([
                'gateway_provider',
                'gateway_transaction_id',
                'gateway_order_id',
                'gateway_status',
                'gateway_fraud_status',
            ]);
        });
    }
};
